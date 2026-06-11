# CLAUDE.md — Conventions and Decisions for Claude Code

This file records architectural decisions, conventions, and preferences for this project so they persist across conversations.

## Project Identity
Static community website for Boisdale Fire Station 34, Nova Scotia. Hosted on GitHub Pages. No server — all data comes from Google Sheets, Google Drive, and Google Calendar via client-side API calls.

## Key Decisions

### Single Posts Tab Architecture
All content lives in the **Posts tab** of the Google Sheet. Do not re-introduce individual category tabs (Notices, FireDept, Community, Projects) as content sources. The website stopped reading those tabs intentionally. If asked to add a new content category, add a new category value to the `<select>` in upload.html and filter by it in `fetchPostsByCategory`.

### Apps Script Deployment Caution
The project has a recurring problem with multiple Apps Script deployments accumulating and the wrong URL being used. Three different URLs have been in use at various points. Rules:
- `CONFIG.APPS_SCRIPT_URL` in config.js is the **only** authoritative URL. All pages use this.
- Never use "New deployment" — always "Manage deployments → pencil → New version → Deploy".
- When the user says they redeployed, always verify by asking them to visit the URL in a browser and confirm doGet returns the expected version string.
- If "Missing field: category" appears for a calendar action, first suspect the wrong deployment URL before debugging code — it's been the root cause repeatedly.
- The `doPost` function must have an explicit `return output;` at the end of every action block. Missing a return causes fall-through to the default create path, which throws "Missing field: category".

### Avoid DOM API Name Collisions
Do not name global JavaScript functions the same as browser DOM APIs. Known collision in this project: `createEvent` conflicts with `document.createEvent()`. Inline `onclick` handlers resolve names through the element/document scope chain before reaching `window`, so DOM methods shadow global functions silently. Use descriptive prefixes like `submitNewEvent`, `handleCreate`, etc.

### Drive Image URLs
Always use `https://drive.google.com/thumbnail?id=FILE_ID&sz=w800` for inline images. Never use `uc?export=view` — Google frequently blocks it. The thumbnail format is confirmed working for header images, slideshow photos, and post attachments.

### No Legacy Sheet Reads
`fetchFiltered()`, `fetchUpcoming()`, and `renderCards()` still exist in the codebase but are no longer called by any page. Do not remove them (backward compat safety), but do not use them for new features. New content always goes through `fetchPostsByCategory()` and `buildPostCard()`.

### Token Security Model
Authentication is a shared plaintext token stored in `localStorage`. This is intentional for a small community site — do not suggest OAuth or more complex auth unless the user raises it as a concern. The token is validated in the Apps Script `doPost` function.

### Push Policy
Always push immediately after making changes unless the user says otherwise. The user has confirmed this workflow.

### CSS Placement
Page-specific styles go in `css/style.css` with a clear section comment, not in `<style>` blocks in the HTML. Exception: upload.html and manage.html have their own inline styles because they are standalone admin tools not part of the main site theme.

### Commit Style
Short imperative subject line. Co-author line always included:
`Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

### Post Card Display Convention
Post cards show the category badge but **not** the posted date — this was intentionally removed. Do not re-add the date unless the user asks. Body text must always go through `formatBody()` (not raw `escHtml()`) to ensure URL auto-linking and newline handling.

### manage.html Post Grouping
Posts are grouped by category then by Active/Future/Expired status. Classification logic: Expired = endDate < today; Future = startDate > today; Active = everything else. Do not revert to a flat list.

### Recurring Calendar Events
`fetchCalendarEvents` uses `singleEvents=true`, so recurring event instances come back as individual events each with a `recurringEventId` field. Use this to detect recurring instances in the UI. Apps Script `CalendarApp.newRecurrence()` is used for creating series; `ev.getEventSeries()` for editing/deleting a series. Time changes to an entire series are not supported via CalendarApp — delete and recreate is the workaround.

Key implementation detail: `addDailyRule()` / `addWeeklyRule()` / `addMonthlyRule()` / `addYearlyRule()` each return a `RecurrenceRule` object. The end condition methods (`times()`, `until()`) and `onlyOnWeekdays()` must be called on that `RecurrenceRule`, not on the parent `EventRecurrence`. Then pass the `EventRecurrence` to `createEventSeries()` / `createAllDayEventSeries()`. Weekday codes from the client (MO/TU/WE/TH/FR/SA/SU) must be mapped to `CalendarApp.Weekday.*` enum values.

### Post Edit/Delete (manage.html)
manage.html sends `action: 'edit'` and `action: 'delete'` for posts, both keyed on `sheetRow` (1-based row number, header = row 1). `edit` updates date/category/title/body/start_date/end_date columns in place and leaves FileURL/FileName/FileType untouched — manage.html does not support changing the attachment ("delete and re-post" is the workaround). `delete` calls `sheet.deleteRow(sheetRow)`. Both require the standard token check.

### Drive Sharing on Uploaded Files
`driveFile.setSharing(...)` after `folder.createFile(blob)` is wrapped in try/catch and treated as non-fatal. Even with deployment "Execute as: Me", a non-owner caller can successfully create a file in the shared Drive folder but can hit "Access denied: DriveApp" when changing that file's sharing settings. The file still inherits the parent folder's sharing, so a failed `setSharing()` should not block post creation.

### Code.gs Repo Sync
`appscript/Code.gs` is the canonical source for the Apps Script. Any manual edits made directly in the Google Apps Script editor must be reflected back in Code.gs and committed. When diagnosing calendar bugs, always check Code.gs first — if it's out of date with the live script, the repo is not the source of truth.

### Google Analytics
GA4 tag `G-SKSZ174GDR` is in the `<head>` of every page. When adding new HTML pages, always include the gtag snippet immediately after `<head>`. The tag ID is `G-SKSZ174GDR`.

## Lessons Learned
- Wrong Apps Script URL is always the first thing to check when writes fail.
- Never click "New deployment" — always update an existing deployment with a new version.
- Every `doPost` action block needs `return output;` or it falls through to create.
- Don't name functions the same as DOM APIs (`createEvent` → `submitNewEvent`).
- Always use `formatBody()` for post body text, never raw `escHtml()` alone.
- Drive image URLs must use `thumbnail?id=...&sz=w800` — `uc?export=view` is blocked.
- Add `https://www.googleapis.com/auth/calendar` scope before using CalendarApp writes.
- Confirm deployment is live by visiting the URL and checking the version string in doGet.
- Recurring events require `createEventSeries()` / `createAllDayEventSeries()` — using `createEvent()` silently creates only a single occurrence with no error.
- `CalendarApp.newRecurrence().addWeeklyRule()` returns a `RecurrenceRule`; call `onlyOnWeekdays()` and `times()` / `until()` on that object, not on the `EventRecurrence`.
- Keep `appscript/Code.gs` in sync with the live Apps Script. If they diverge, debugging is unreliable.
- `doPost` action blocks for `edit`/`delete` (or any new action) must exist explicitly — without one, the payload falls through to the generic post-create path, causing duplicate posts or "Missing field: category" errors.
- `driveFile.setSharing()` can throw "Access denied: DriveApp" for non-owner callers even under "Execute as: Me" — wrap it in try/catch and don't let it block the rest of the operation.

## File Map (quick reference)
- Config: `js/config.js`
- API layer: `js/google-api.js`
- UI helpers: `js/ui.js`
- Styles: `css/style.css`
- Public admin: `upload.html`, `manage.html`, `events-manage.html` (root level, not in pages/)
- Content pages: `pages/*.html`

## Google Sheet Structure
Spreadsheet ID: `1jlcWZnge9bEFGr0GIK2FfgYfcXLS5WtNkZXNKINYryw`
Posts tab columns (0-indexed as used in JS):
`[0]Timestamp [1]Date [2]Category [3]Title [4]Body [5]FileURL [6]FileName [7]FileType [8]StartDate [9]EndDate`

Row 0 is the header row. `fetchPostsByCategory` skips it by detecting "timestamp" in the first cell.

## Posting from non-authenticated browser
Drive file URL format after upload
After saving a file to Drive via DriveApp.createFile(), do not use driveFile.getUrl() to store the file URL. It returns a drive.google.com/file/d/FILE_ID/view?usp=drivesdk URL which causes "Drive app access denied" errors for users who are not authenticated to the Google account that owns the file.
Use the direct embed URL instead:
javascriptfileUrl = `https://drive.google.com/uc?export=view&id=${driveFile.getId()}`;
This format is publicly accessible as long as the file sharing is set to ANYONE_WITH_LINK, and renders correctly as an image src in the browser.
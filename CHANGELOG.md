# Changelog

## 2026-05-02 (session 2)

### upload.html
- Post Date field is now read-only — always shows today's date, cannot be edited by the user.

## 2026-05-02

### Analytics
- Added Google Analytics tag (G-SKSZ174GDR) to all 12 HTML pages via gtag.js.

## 2026-04-29

### New Features
- **events-manage.html** — recurring event support: new event form now has a Repeat toggle with frequency (Daily/Weekly/Monthly/Yearly), weekday picker for weekly events, and end condition (never/after N times/on date). Recurring event instances show a "↻ Recurring" badge in the list.
- **events-manage.html** — editing recurring events offers a scope choice: "This occurrence only" or "Entire series" (series edits restricted to title, description, location). Deleting recurring events prompts for occurrence vs. entire series.
- **manage.html** — posts now grouped by category (Notice/Fire Dept/Community/Project Updates) then by status (Active/Future/Expired) within each category. Status determined by start/end dates.
- **ui.js** — post body text now auto-linkifies `http(s)://` URLs via `formatBody()`.

### Appearance
- Removed posted dates from all post cards.
- Event date headers in Upcoming Events now display as green pill badges.
- Divider lines between event day groups strengthened to 2px muted green.
- Phone number updated to 902-871-2482 across all pages.

### Apps Script (Code.gs) — manual changes required by user
- `cal-create` block updated to support recurrence via `CalendarApp.newRecurrence()` and `createEventSeries()` / `createAllDayEventSeries()`.
- `cal-edit` block updated to handle `edit_scope: 'series'` — calls `ev.getEventSeries()` for series edits.
- `cal-delete` block updated to handle `delete_scope: 'series'` — calls `ev.getEventSeries().deleteEventSeries()`.

## 2026-04-20 (session 2)

### New Features
- **events-manage.html** — new token-gated admin page for creating, editing, and deleting Google Calendar events. Actions post to Apps Script with `cal-create`, `cal-edit`, `cal-delete` actions.

### Bug Fixes
- Fixed `CONFIG.APPS_SCRIPT_URL` in config.js — it was pointing to a stale old deployment again (third distinct URL found). Removed dead `FORMS_ENDPOINT` alias that was causing confusion.
- Fixed `cal-edit` and `cal-delete` returning "Missing field: category" — the doPost in Apps Script was missing `return output;` after the cal-edit block, causing fall-through to the default create path.
- Fixed "TypeError: Not enough arguments" when creating calendar events — `createEvent` is a reserved DOM method name (`document.createEvent()`). Renamed to `submitNewEvent()`.
- Fixed new event panel staying open after successful create — added `toggleNewForm()` call in the success path.
- Fixed upload.html staying on page after posting — now redirects to manage.html after 1.5 seconds.

### Apps Script (Code.gs) — manual changes required by user
- Added `cal-create`, `cal-edit`, `cal-delete` action handlers to `doPost`.
- Added `https://www.googleapis.com/auth/calendar` to `oauthScopes` in `appsscript.json` to allow CalendarApp write access.
- Each action block must have an explicit `return output;` — fall-through to the create path causes "Missing field: category".

## 2026-04-20

### Architecture
- Consolidated all content into a single **Posts tab** in the Google Sheet. Removed all individual sheet tab reads (Notices, FireDept, Community, Projects) from the website. All category pages and index.html now read exclusively from `Posts` via `fetchPostsByCategory(category)`.

### New Features
- **upload.html** — added "Visible From" and "Visible Until" date fields so posts automatically appear and disappear based on a date range. Both fields are optional (empty = always visible).
- **manage.html** — new admin page for editing and deleting posts directly from the browser without touching Google Sheets. Token-gated. Loads posts via Sheets API; writes via Apps Script.
- **Post cards** — `UI.buildPostCard()` renders Posts tab rows with category badge, date, body text, and optional image or PDF attachment.
- **Image rendering** — fixed Drive image display by switching from `uc?export=view` (frequently blocked) to `thumbnail?id=...&sz=w800` (same format used by header and slideshow photos).
- **manage.html** — added "+ New Post" button linking to upload.html.

### Layout
- **index.html** — two-column layout: posts (Fire Dept, Community, Projects) on the left; Upcoming Events calendar on the right (sticky). Stacks to single column below 860px.
- **Calendar display** — replaced wide four-column table with a compact stacked list: date as a bold header, then time + event title on the same line below. Fits the narrow right column cleanly.

### Bug Fixes
- Fixed `APPS_SCRIPT_URL` in config.js — it was pointing to an old stale deployment. All upload/edit/delete operations were silently hitting the wrong endpoint.
- Added missing `.post-card`, `.post-meta`, `.post-category`, `.post-date`, `.post-title`, `.post-body` CSS classes.
- Added `min-width: 0` and `overflow-x: hidden` to home grid columns to prevent events table from overflowing its column.

### Apps Script (Code.gs) — manual changes required by user
- `doPost` updated to handle `action: 'edit'` and `action: 'delete'` in addition to the default create flow.
- `sheet.appendRow` extended with two new columns: `StartDate` (col 9) and `EndDate` (col 10).
- Posts tab header row should be: `Timestamp | Date | Category | Title | Body | FileURL | FileName | FileType | StartDate | EndDate`

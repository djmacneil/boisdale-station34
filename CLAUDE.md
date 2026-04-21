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

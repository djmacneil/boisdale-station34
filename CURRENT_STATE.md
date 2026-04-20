# Current State — Boisdale Fire Station 34 Website

## Overview
Static website hosted on GitHub Pages. All content is stored in Google Sheets and Google Drive; the site reads data client-side using the Google Sheets API and Google Drive API. Write operations (create/edit/delete posts) go through a Google Apps Script web app.

## Live URLs
- **Site:** https://djmacneil.github.io/boisdale-station34/
- **Upload:** https://djmacneil.github.io/boisdale-station34/upload.html
- **Manage:** https://djmacneil.github.io/boisdale-station34/manage.html
- **Apps Script:** see `CONFIG.APPS_SCRIPT_URL` in js/config.js

## Content Architecture

### Single source of truth: Posts tab
All content (notices, fire dept, community, projects) lives in the **Posts tab** of the Google Sheet (`CONFIG.SPREADSHEET_ID`). Individual category sheet tabs (Notices, FireDept, Community, Projects) are no longer read by the website — they can be archived or ignored.

#### Posts tab column order (1-indexed)
| Col | Field      | Notes                                      |
|-----|------------|--------------------------------------------|
| A   | Timestamp  | ISO string, set by Apps Script on create   |
| B   | Date       | Display date (YYYY-MM-DD)                  |
| C   | Category   | Notice / FireDept / Community / Projects   |
| D   | Title      |                                            |
| E   | Body       |                                            |
| F   | FileURL    | Drive sharing URL (empty if no attachment) |
| G   | FileName   |                                            |
| H   | FileType   | MIME type                                  |
| I   | StartDate  | Visibility start (YYYY-MM-DD, optional)    |
| J   | EndDate    | Visibility end (YYYY-MM-DD, optional)      |

Row 1 must be a header row. `fetchPostsByCategory` detects this by checking if row[0][0].toLowerCase() === 'timestamp'.

### Config tab
Still read by `fetchConfig()` for phone/email overrides in the footer. Two columns: key, value.

### Drive folders (all in CONFIG.DRIVE_FOLDERS)
- `MINUTES` — meeting minutes documents (firedept.html)
- `PROJECTS` — project documents (projects.html)
- `GENERAL` — community documents (community.html)
- `PHOTOS` — slideshow photos (index.html)
- `HEADER_IMAGES` — hero section images named `Header_Left_Image` and `Header_Right_Image`

## Key Files

| File | Purpose |
|------|---------|
| `js/config.js` | All IDs, keys, URLs. Edit here to reconfigure. |
| `js/google-api.js` | Sheets/Drive/Calendar API wrappers. `fetchPostsByCategory(category)` is the main content fetch. |
| `js/ui.js` | Rendering helpers. `buildPostCard(row)` renders a Posts tab row. `buildCard(row)` renders a legacy sheet row object. |
| `css/style.css` | All styles. |
| `upload.html` | Token-gated form for creating new posts with optional file attachment. |
| `manage.html` | Token-gated admin page for editing and deleting existing posts. |
| `index.html` | Home page. Two-column: posts left, calendar right. |
| `pages/notices.html` | Shows Posts with category=Notice. |
| `pages/meetings.html` | Shows Posts with category=FireDept. |
| `pages/firedept.html` | Shows Posts with category=FireDept + Drive minutes list. |
| `pages/community.html` | Shows Posts with category=Community + Drive documents list. |
| `pages/projects.html` | Shows Posts with category=Projects + Drive documents list. |
| `pages/calendar.html` | Full Google Calendar embed. |

## Apps Script (Code.gs)
Deployed as a web app — "Execute as: Me", "Who has access: Anyone".

### doPost actions
| action | Payload fields | Effect |
|--------|---------------|--------|
| `create` (default) | category, date, title, body, token, optionally fileBase64/fileName/fileType, start_date, end_date | Appends new row to Posts tab, uploads file to Drive |
| `edit` | token, sheetRow, date, category, title, body, start_date, end_date | Updates existing row (preserves timestamp and file columns) |
| `delete` | token, sheetRow | Deletes the row |

### doGet
Returns `{ status: 'ok', service: 'BS34 Post Endpoint', version: 'vN' }` — used as a health check.

## Authentication
- **Read** (public site): Google Sheets API key in `CONFIG.GOOGLE_API_KEY`. The spreadsheet must be shared as "Anyone with the link can view".
- **Write** (upload/manage): Shared token stored in `localStorage` under key `bs34_post_token`. Token is validated server-side in Apps Script (`SHARED_TOKEN` constant).

## Known Working
- Creating posts with text and image/PDF attachments via upload.html
- Deleting posts via manage.html
- Editing posts via manage.html (pending Apps Script deploy of edit action)
- Home page two-column layout
- Calendar event display (compact list format)
- Drive image thumbnails rendering correctly
- Start/end date visibility filtering

## Pending / Known Issues
- The Apps Script `action: 'edit'` has been provided in code but the user should verify it is deployed and working.
- The spreadsheet's Posts tab needs to be verified as publicly shared ("Anyone with the link can view") — there have been intermittent 403/404 errors when fetching the Posts tab via the Sheets API, possibly due to API key HTTP referrer restrictions.

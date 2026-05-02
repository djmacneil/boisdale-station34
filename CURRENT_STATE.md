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

## Admin Pages
| Page | Purpose |
|------|---------|
| `upload.html` | Create new posts. Redirects to manage.html on success. |
| `manage.html` | Edit and delete existing posts. Grouped by category then Active/Future/Expired. |
| `events-manage.html` | Create, edit, and delete Google Calendar events including recurring events. |

## Known Working
- Creating posts with text and image/PDF attachments via upload.html
- Deleting and editing posts via manage.html (grouped by category + status)
- Creating, editing, and deleting calendar events via events-manage.html
- Creating recurring events (daily/weekly/monthly/yearly) with end conditions
- Editing recurring events: this occurrence or entire series
- Deleting recurring events: this occurrence or entire series
- Home page two-column layout
- Calendar event display (compact list format with green date badges)
- Drive image thumbnails rendering correctly
- Start/end date visibility filtering
- URLs in post body text auto-link on all pages

## Post Card Display
- Category badge shown; posted date is intentionally hidden
- Body text HTML-escaped then URLs linkified and newlines converted to `<br>`

## Apps Script Deployment
- **Active URL:** stored in `CONFIG.APPS_SCRIPT_URL` in js/config.js
- **doPost actions:** `delete`, `edit`, `cal-create`, `cal-edit`, `cal-delete`, `create` (default)
- **Required OAuth scopes** (in appsscript.json): `spreadsheets`, `drive`, `calendar`, `script.external_request`
- Always update via "Manage deployments → pencil → New version" — never "New deployment"

## Analytics
Google Analytics (GA4) tag `G-SKSZ174GDR` is present in the `<head>` of all 12 HTML pages.

## Pending / Known Issues
- None known at this time.

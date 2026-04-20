# Changelog

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

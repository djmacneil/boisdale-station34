// ============================================================
//  Boisdale Station 34 — Apps Script POST endpoint
//  Handles both text-only posts and posts with file attachments.
//
//  Setup:
//    1. Paste this entire file into your Apps Script project.
//    2. Set the five constants below.
//    3. Deploy → New deployment → Web app
//       Execute as: Me
//       Who has access: Anyone
//    4. Copy the deployment URL into js/config.js as APPS_SCRIPT_URL.
// ============================================================

// ── Configuration — edit these ───────────────────────────────
const SHARED_TOKEN      = 'your-secret-token-here';   // must match localStorage token
const SHEET_ID          = 'YOUR_GOOGLE_SHEET_ID';     // from the Sheet URL
const SHEET_TAB_NAME    = 'Posts';                     // tab name in the Sheet
const DRIVE_FOLDER_ID   = 'YOUR_DRIVE_FOLDER_ID';     // folder where attachments are saved
                                                        // leave blank '' to skip Drive and just store URL as empty
const MAX_FILE_MB       = 10;                          // reject files larger than this
// ─────────────────────────────────────────────────────────────

/**
 * Allowed MIME types.  Extend as needed.
 */
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
];

// ── Entry point ───────────────────────────────────────────────
function doPost(e) {
  // Apps Script always wraps the response in a TextOutput for CORS.
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Parse body — client sends JSON as text/plain to avoid CORS preflight.
    const data = JSON.parse(e.postData.contents);

    // ── Auth ──────────────────────────────────────────────────
    if (!data.token || data.token !== SHARED_TOKEN) {
      output.setContent(JSON.stringify({ status: 'error', message: 'Invalid token.' }));
      return output;
    }

    // ── Validate required fields ──────────────────────────────
    const required = ['category', 'date', 'title', 'body'];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim() === '') {
        output.setContent(JSON.stringify({ status: 'error', message: `Missing field: ${field}` }));
        return output;
      }
    }

    // ── Handle file attachment ────────────────────────────────
    let fileUrl  = '';
    let fileName = '';
    let fileType = '';

    if (data.fileBase64) {
      // Validate type
      if (!ALLOWED_TYPES.includes(data.fileType)) {
        output.setContent(JSON.stringify({ status: 'error', message: 'File type not allowed.' }));
        return output;
      }

      // Validate size (base64 is ~4/3 of original, so multiply by 0.75)
      const approxBytes = Math.round(data.fileBase64.length * 0.75);
      if (approxBytes > MAX_FILE_MB * 1024 * 1024) {
        output.setContent(JSON.stringify({ status: 'error', message: `File exceeds ${MAX_FILE_MB} MB limit.` }));
        return output;
      }

      // Decode and save to Drive
      const blob    = Utilities.newBlob(
        Utilities.base64Decode(data.fileBase64),
        data.fileType,
        sanitizeFileName(data.fileName)
      );

      const folder  = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const driveFile = folder.createFile(blob);

      // Make the file viewable by anyone with the link
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      fileUrl  = driveFile.getUrl();
      fileName = driveFile.getName();
      fileType = data.fileType;
    }

    // ── Write row to Sheet ────────────────────────────────────
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_TAB_NAME);

    if (!sheet) {
      output.setContent(JSON.stringify({ status: 'error', message: `Sheet tab "${SHEET_TAB_NAME}" not found.` }));
      return output;
    }

    const timestamp = new Date().toISOString();

    // Column order:  Timestamp | Date | Category | Title | Body | FileURL | FileName | FileType
    // If this is your first post, you may want to add a header row manually:
    //   Timestamp, Date, Category, Title, Body, FileURL, FileName, FileType
    sheet.appendRow([
      timestamp,
      data.date.trim(),
      data.category.trim(),
      data.title.trim(),
      data.body.trim(),
      fileUrl,
      fileName,
      fileType
    ]);

    output.setContent(JSON.stringify({ status: 'ok', message: 'Post saved.' }));

  } catch (err) {
    output.setContent(JSON.stringify({ status: 'error', message: err.message }));
  }

  return output;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Strip path traversal and control characters from uploaded file names.
 */
function sanitizeFileName(name) {
  if (!name) return 'attachment';
  // Remove path components and characters that are problematic on Drive
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_')
    .trim()
    .substring(0, 200) || 'attachment';
}

// ── Optional: GET handler for health-check ────────────────────
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'BS34 Post Endpoint' }))
    .setMimeType(ContentService.MimeType.JSON);
}

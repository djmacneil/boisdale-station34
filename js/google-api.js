/**
 * google-api.js
 * Thin wrapper around Google Sheets and Drive APIs.
 * All functions return plain arrays of objects.
 */

const GoogleAPI = (() => {

  // ─── Sheets ───────────────────────────────────────────────────────────────

  /**
   * Fetch a named sheet tab and return rows as objects keyed by header row.
   * Requires the sheet to be shared as "Anyone with the link can view".
   */
  async function fetchSheet(sheetName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${CONFIG.GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const data = await res.json();
    const [headers, ...rows] = data.values || [];
    if (!headers) return [];
    return rows.map(row =>
      Object.fromEntries(headers.map((h, i) => [h.trim(), (row[i] || "").trim()]))
    );
  }

  /**
   * Filter rows by start_date / end_date columns (both optional).
   * Used for NOTICES: only shows rows where today falls within the window.
   * Column names must be exactly: start_date, end_date (YYYY-MM-DD format).
   */
  function filterByDate(rows) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter(row => {
      const start = row.start_date ? parseLocalDate(row.start_date) : new Date(0);
      const end   = row.end_date   ? parseLocalDate(row.end_date)   : new Date("2099-12-31");
      return today >= start && today <= end;
    });
  }

  function filterUpcoming(rows) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter(row => {
      const end = row.end_date   ? parseLocalDate(row.end_date)
                : row.start_date ? parseLocalDate(row.start_date)
                : new Date("2099-12-31");
      return today <= end;
    });
  }

  // Parse YYYY-MM-DD as local midnight, not UTC (avoids timezone day-shift)
  function parseLocalDate(str) {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  /**
   * Convenience: fetch a sheet and apply date filtering (for notices/community).
   */
  async function fetchFiltered(sheetName) {
    const rows = await fetchSheet(sheetName);
    return filterByDate(rows);
  }

  /**
   * Convenience: fetch a sheet and show upcoming/current events (for events/projects).
   */
  async function fetchUpcoming(sheetName) {
    const rows = await fetchSheet(sheetName);
    return filterUpcoming(rows);
  }

  // ─── Drive ────────────────────────────────────────────────────────────────

  /**
   * List files in a Drive folder.
   * The folder must be shared as "Anyone with the link can view".
   * Returns array of { id, name, mimeType, webViewLink, createdTime, size }
   */
  async function listDriveFolder(folderId) {
    const fields = "files(id,name,mimeType,webViewLink,createdTime,size)";
    const query  = `'${folderId}'+in+parents+and+trashed=false`;
    const url    = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${encodeURIComponent(fields)}&orderBy=createdTime+desc&key=${CONFIG.GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive fetch failed: ${res.status}`);
    const data = await res.json();
    return data.files || [];
  }

  /**
   * Friendly icon for a MIME type.
   */
  function mimeIcon(mimeType) {
    if (mimeType.includes("pdf"))         return "📄";
    if (mimeType.includes("spreadsheet")) return "📊";
    if (mimeType.includes("document"))    return "📝";
    if (mimeType.includes("presentation"))return "📋";
    if (mimeType.includes("image"))       return "🖼️";
    if (mimeType.includes("folder"))      return "📁";
    return "📎";
  }

  /**
   * Format a Drive file size to human-readable string.
   */
  function formatSize(bytes) {
    if (!bytes) return "";
    const n = parseInt(bytes, 10);
    if (n < 1024)          return `${n} B`;
    if (n < 1024 * 1024)   return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─── Calendar ─────────────────────────────────────────────────────────────

  /**
   * Fetch upcoming events from Google Calendar for the next N months.
   * Returns the raw event items array from the Calendar API.
   */
  async function fetchCalendarEvents(calendarId, days = 60) {
    const now   = new Date();
    const later = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      + `?key=${CONFIG.GOOGLE_API_KEY}`
      + `&timeMin=${encodeURIComponent(now.toISOString())}`
      + `&timeMax=${encodeURIComponent(later.toISOString())}`
      + `&singleEvents=true&orderBy=startTime&maxResults=50`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
    const data = await res.json();
    return data.items || [];
  }

  // ─── Posts tab (upload.html submissions) ─────────────────────────────────

  /**
   * Fetch rows from the Posts tab, optionally filtered by Category.
   * Pass null/undefined for category to get all categories.
   * Filters by StartDate (col 8) and EndDate (col 9) — empty means always visible.
   * Returns raw arrays newest-first:
   *   [Timestamp, Date, Category, Title, Body, FileURL, FileName, FileType, StartDate, EndDate]
   */
  async function fetchPostsByCategory(category) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/Posts?key=${CONFIG.GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const data = await res.json();
    const allRows = data.values || [];
    if (!allRows.length) return [];
    // Skip header row if present (first cell = "Timestamp")
    const rows = (allRows[0][0] || '').toLowerCase() === 'timestamp'
      ? allRows.slice(1) : allRows;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rows
      .filter(row => {
        if (category && (row[2] || '').trim() !== category) return false;
        const start = row[8] ? parseLocalDate(row[8]) : new Date(0);
        const end   = row[9] ? parseLocalDate(row[9]) : new Date('2099-12-31');
        return today >= start && today <= end;
      })
      .reverse(); // newest first
  }

  // ─── Config sheet ─────────────────────────────────────────────────────────

  /**
   * Fetch the Config sheet and return a plain key→value object.
   * Expects columns named "key" and "value".
   */
  async function fetchConfig(sheetName = "Config") {
    const rows = await fetchSheet(sheetName);
    const cfg = {};
    rows.forEach(row => {
      const cols = Object.values(row);
      if (cols[0]) cfg[cols[0].trim()] = (cols[1] || "").trim();
    });
    return cfg;
  }

  return { fetchSheet, fetchFiltered, fetchUpcoming, filterByDate, filterUpcoming, listDriveFolder, mimeIcon, formatSize, fetchCalendarEvents, fetchConfig, fetchPostsByCategory };
})();

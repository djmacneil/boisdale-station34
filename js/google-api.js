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

  // ─── Config sheet ─────────────────────────────────────────────────────────

  /**
   * Fetch the Config sheet and return a plain key→value object.
   * Expects columns named "key" and "value".
   */
  async function fetchConfig(sheetName = "Config") {
    console.log("fetchConfig called, fetching sheet:", sheetName);
    const rows = await fetchSheet(sheetName);
    console.log("fetchConfig raw rows:", rows);
    const cfg = {};
    rows.forEach(row => {
      if (row.key) cfg[row.key.trim()] = (row.value || "").trim();
    });
    return cfg;
  }

  return { fetchSheet, fetchFiltered, fetchUpcoming, filterByDate, filterUpcoming, listDriveFolder, mimeIcon, formatSize, fetchCalendarEvents, fetchConfig };
})();

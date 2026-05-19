// ============================================================
//  Boisdale Station 34 — Apps Script POST endpoint
//  Handles posts (sheet), file attachments (Drive), and
//  calendar events (create / edit / delete).
//
//  Setup:
//    1. Paste this entire file into your Apps Script project.
//    2. Set the constants below.
//    3. Deploy → Manage deployments → pencil → New version → Deploy.
//       Execute as: Me  |  Who has access: Anyone
//    4. Copy the deployment URL into js/config.js as APPS_SCRIPT_URL.
// ============================================================

// ── Configuration ────────────────────────────────────────────
const SHARED_TOKEN    = 'your-secret-token-here';   // must match localStorage token
const SHEET_ID        = 'YOUR_GOOGLE_SHEET_ID';     // from Sheet URL
const SHEET_TAB_NAME  = 'Posts';
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';
const CALENDAR_ID     = 'YOUR_CALENDAR_ID';         // from Calendar settings
const MAX_FILE_MB     = 10;
// ─────────────────────────────────────────────────────────────

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf'
];

// ── Entry point ───────────────────────────────────────────────
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);

    if (!data.token || data.token !== SHARED_TOKEN) {
      output.setContent(JSON.stringify({ status: 'error', message: 'Invalid token.' }));
      return output;
    }

    // ── Calendar: create ──────────────────────────────────────
    if (data.action === 'cal-create') {
      const cal    = CalendarApp.getCalendarById(CALENDAR_ID);
      const allDay = !!data.all_day;
      const opts   = {};
      if (data.description) opts.description = data.description;
      if (data.location)    opts.location    = data.location;

      const startDt = parseDateTime(data.start_date, allDay ? null : data.start_time);
      const endDt   = parseDateTime(data.end_date,   allDay ? null : data.end_time);

      if (data.recurrence) {
        const rule    = buildRecurrenceRule(data.recurrence);
        if (allDay) {
          cal.createAllDayEventSeries(data.title, startDt, rule, opts);
        } else {
          cal.createEventSeries(data.title, startDt, endDt, rule, opts);
        }
      } else {
        if (allDay) {
          if (data.end_date && data.end_date !== data.start_date) {
            cal.createAllDayEvent(data.title, startDt, endDt, opts);
          } else {
            cal.createAllDayEvent(data.title, startDt, opts);
          }
        } else {
          cal.createEvent(data.title, startDt, endDt, opts);
        }
      }

      output.setContent(JSON.stringify({ status: 'ok', message: 'Event created.' }));
      return output;
    }

    // ── Calendar: edit ────────────────────────────────────────
    if (data.action === 'cal-edit') {
      const cal = CalendarApp.getCalendarById(CALENDAR_ID);
      const ev  = cal.getEventById(data.event_id);
      if (!ev) {
        output.setContent(JSON.stringify({ status: 'error', message: 'Event not found.' }));
        return output;
      }

      if (data.edit_scope === 'series') {
        const series = ev.getEventSeries();
        if (data.title)                       series.setTitle(data.title);
        if (data.description !== undefined)   series.setDescription(data.description);
        if (data.location !== undefined)      series.setLocation(data.location);
      } else {
        if (data.title)                     ev.setTitle(data.title);
        if (data.description !== undefined) ev.setDescription(data.description);
        if (data.location !== undefined)    ev.setLocation(data.location);

        if (data.start_date) {
          const allDay   = !!data.all_day;
          const newStart = parseDateTime(data.start_date, allDay ? null : data.start_time);
          const newEnd   = parseDateTime(data.end_date,   allDay ? null : data.end_time);
          if (allDay) {
            ev.setAllDayDates(newStart, newEnd);
          } else {
            ev.setTime(newStart, newEnd);
          }
        }
      }

      output.setContent(JSON.stringify({ status: 'ok', message: 'Event updated.' }));
      return output;
    }

    // ── Calendar: delete ──────────────────────────────────────
    if (data.action === 'cal-delete') {
      const cal = CalendarApp.getCalendarById(CALENDAR_ID);
      const ev  = cal.getEventById(data.event_id);
      if (!ev) {
        output.setContent(JSON.stringify({ status: 'error', message: 'Event not found.' }));
        return output;
      }

      if (data.delete_scope === 'series') {
        ev.getEventSeries().deleteEventSeries();
      } else {
        ev.deleteEvent();
      }

      output.setContent(JSON.stringify({ status: 'ok', message: 'Event deleted.' }));
      return output;
    }

    // ── Post: validate required fields ────────────────────────
    const required = ['category', 'date', 'title', 'body'];
    for (const field of required) {
      if (!data[field] || String(data[field]).trim() === '') {
        output.setContent(JSON.stringify({ status: 'error', message: `Missing field: ${field}` }));
        return output;
      }
    }

    // ── Post: handle file attachment ──────────────────────────
    let fileUrl  = '';
    let fileName = '';
    let fileType = '';

    if (data.fileBase64) {
      if (!ALLOWED_TYPES.includes(data.fileType)) {
        output.setContent(JSON.stringify({ status: 'error', message: 'File type not allowed.' }));
        return output;
      }
      const approxBytes = Math.round(data.fileBase64.length * 0.75);
      if (approxBytes > MAX_FILE_MB * 1024 * 1024) {
        output.setContent(JSON.stringify({ status: 'error', message: `File exceeds ${MAX_FILE_MB} MB limit.` }));
        return output;
      }
      const blob      = Utilities.newBlob(
        Utilities.base64Decode(data.fileBase64), data.fileType, sanitizeFileName(data.fileName)
      );
      const folder    = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const driveFile = folder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl  = driveFile.getUrl();
      fileName = driveFile.getName();
      fileType = data.fileType;
    }

    // ── Post: write row to Sheet ──────────────────────────────
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_TAB_NAME);
    if (!sheet) {
      output.setContent(JSON.stringify({ status: 'error', message: `Sheet tab "${SHEET_TAB_NAME}" not found.` }));
      return output;
    }

    sheet.appendRow([
      new Date().toISOString(),
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
 * Build an EventRecurrence from the payload sent by events-manage.html.
 * Payload shape: { freq, end_type, days?, end_count?, end_date? }
 */
function buildRecurrenceRule(rec) {
  const WD = {
    SU: CalendarApp.Weekday.SUNDAY,
    MO: CalendarApp.Weekday.MONDAY,
    TU: CalendarApp.Weekday.TUESDAY,
    WE: CalendarApp.Weekday.WEDNESDAY,
    TH: CalendarApp.Weekday.THURSDAY,
    FR: CalendarApp.Weekday.FRIDAY,
    SA: CalendarApp.Weekday.SATURDAY
  };

  const rule = CalendarApp.newRecurrence();
  let recRule;

  switch (rec.freq) {
    case 'DAILY':
      recRule = rule.addDailyRule();
      break;
    case 'WEEKLY':
      recRule = rule.addWeeklyRule();
      if (rec.days && rec.days.length > 0) {
        recRule = recRule.onlyOnWeekdays(rec.days.map(d => WD[d]).filter(Boolean));
      }
      break;
    case 'MONTHLY':
      recRule = rule.addMonthlyRule();
      break;
    case 'YEARLY':
      recRule = rule.addYearlyRule();
      break;
    default:
      recRule = rule.addDailyRule();
  }

  if (rec.end_type === 'count' && rec.end_count) {
    recRule.times(parseInt(rec.end_count, 10));
  } else if (rec.end_type === 'date' && rec.end_date) {
    recRule.until(new Date(rec.end_date + 'T23:59:59'));
  }

  return rule;
}

/** Parse a date string + optional time string into a Date object. */
function parseDateTime(dateStr, timeStr) {
  if (timeStr) {
    return new Date(dateStr + 'T' + timeStr + ':00');
  }
  return new Date(dateStr + 'T00:00:00');
}

/** Strip path traversal and control characters from uploaded file names. */
function sanitizeFileName(name) {
  if (!name) return 'attachment';
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '_')
    .trim()
    .substring(0, 200) || 'attachment';
}

// ── GET: health check / version ───────────────────────────────
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'BS34 Endpoint v3' }))
    .setMimeType(ContentService.MimeType.JSON);
}

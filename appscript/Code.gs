// ============================================================
//  Boisdale Station 34 — Apps Script POST endpoint
//  Handles posts (sheet), file attachments (Drive),
//  calendar events (create / edit / delete), and
//  hall booking requests (submit / update / list).
//
//  Setup:
//    1. Paste this entire file into your Apps Script project.
//    2. Set the constants below.
//    3. Deploy → Manage deployments → pencil → New version → Deploy.
//       Execute as: Me  |  Who has access: Anyone
//    4. Copy the deployment URL into js/config.js as APPS_SCRIPT_URL.
// ============================================================

// ── Configuration ────────────────────────────────────────────
const SHARED_TOKEN      = 'your-secret-token-here';   // must match localStorage token
const SHEET_ID          = 'YOUR_GOOGLE_SHEET_ID';     // from Sheet URL
const SHEET_TAB_NAME    = 'Posts';
const BOOKING_TAB_NAME  = 'HallBookings';              // NEW — booking requests tab
const DRIVE_FOLDER_ID   = 'YOUR_DRIVE_FOLDER_ID';
const CALENDAR_ID       = 'YOUR_CALENDAR_ID';         // from Calendar settings
const MAX_FILE_MB       = 10;
// ─────────────────────────────────────────────────────────────

// HallBookings column indices (0-based).
// Public form writes A–N (0–13). Staff writes Q–AO (16–40).
const BC = {
  TIMESTAMP:        0,   // A  — submission timestamp
  BOOKING_ID:       1,   // B  — BK-YYYY-NNN
  STATUS:           2,   // C  — workflow status
  NAME:             3,   // D
  EMAIL:            4,   // E
  PHONE:            5,   // F
  EVENT_NAME:       6,   // G
  EVENT_DATE:       7,   // H
  EVENT_END_DATE:   8,   // I
  START_TIME:       9,   // J
  END_TIME:         10,  // K
  ATTENDANCE:       11,  // L
  FACILITIES:       12,  // M  — comma-separated checklist
  REQUESTOR_NOTES:  13,  // N
  // O (14), P (15) reserved
  RENTAL_FEE:       16,  // Q  ── staff fields begin ──
  DEPOSIT_REQUIRED: 17,  // R
  DEPOSIT_AMOUNT:   18,  // S
  DEPOSIT_RECEIVED: 19,  // T
  FINAL_DUE:        20,  // U
  FINAL_RECEIVED:   21,  // V
  SETUP_TIME:       22,  // W
  TEARDOWN_TIME:    23,  // X
  TABLES:           24,  // Y
  CHAIRS:           25,  // Z
  KITCHEN:          26,  // AA — "Yes – details" or "No"
  BAR:              27,  // AB — "Yes – Licence #..." or "No"
  STAGE:            28,  // AC
  AV:               29,  // AD
  PARKING_NOTES:    30,  // AE
  CLEANING_NOTES:   31,  // AF
  SPECIAL_CONDITIONS: 32, // AG
  ASSIGNED_TO:      33,  // AH
  FIRST_CONTACT:    34,  // AI
  CONTACT_METHOD:   35,  // AJ
  CONTRACT_SENT:    36,  // AK
  CONTRACT_SIGNED:  37,  // AL
  INTERNAL_NOTES:   38,  // AM
  LAST_UPDATED:     39,  // AN — auto-written on every staff save
  LAST_UPDATED_BY:  40,  // AO
  _TOTAL_COLS:      41   // A–AO inclusive
};

// Staff-editable fields: maps payload key → column index.
// Only these keys are accepted in a booking-update call.
const STAFF_FIELDS = {
  name:               BC.NAME,
  email:              BC.EMAIL,
  phone:              BC.PHONE,
  event_name:         BC.EVENT_NAME,
  event_date:         BC.EVENT_DATE,
  event_end_date:     BC.EVENT_END_DATE,
  start_time:         BC.START_TIME,
  end_time:           BC.END_TIME,
  attendance:         BC.ATTENDANCE,
  facilities:         BC.FACILITIES,
  requestor_notes:    BC.REQUESTOR_NOTES,
  status:             BC.STATUS,
  assigned_to:        BC.ASSIGNED_TO,
  internal_notes:     BC.INTERNAL_NOTES,
  rental_fee:         BC.RENTAL_FEE,
  deposit_required:   BC.DEPOSIT_REQUIRED,
  deposit_amount:     BC.DEPOSIT_AMOUNT,
  deposit_received:   BC.DEPOSIT_RECEIVED,
  final_due:          BC.FINAL_DUE,
  final_received:     BC.FINAL_RECEIVED,
  setup_time:         BC.SETUP_TIME,
  teardown_time:      BC.TEARDOWN_TIME,
  tables:             BC.TABLES,
  chairs:             BC.CHAIRS,
  kitchen:            BC.KITCHEN,
  bar:                BC.BAR,
  stage:              BC.STAGE,
  av:                 BC.AV,
  parking_notes:      BC.PARKING_NOTES,
  cleaning_notes:     BC.CLEANING_NOTES,
  special_conditions: BC.SPECIAL_CONDITIONS,
  first_contact:      BC.FIRST_CONTACT,
  contact_method:     BC.CONTACT_METHOD,
  contract_sent:      BC.CONTRACT_SENT,
  contract_signed:    BC.CONTRACT_SIGNED
};

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

    // ── Booking: submit (public form — no token required) ─────
    if (data.action === 'booking-submit') {
      const reqd = ['name', 'email', 'phone', 'event_name', 'event_date'];
      for (const f of reqd) {
        if (!data[f] || String(data[f]).trim() === '') {
          output.setContent(JSON.stringify({ status: 'error', message: `Missing field: ${f}` }));
          return output;
        }
      }

      const ss      = SpreadsheetApp.openById(SHEET_ID);
      const bSheet  = ss.getSheetByName(BOOKING_TAB_NAME);
      if (!bSheet) {
        output.setContent(JSON.stringify({ status: 'error', message: `Sheet tab "${BOOKING_TAB_NAME}" not found.` }));
        return output;
      }

      // Generate BookingID: BK-YYYY-NNN (padded sequential)
      const year    = new Date().getFullYear();
      const lastRow = bSheet.getLastRow();
      let   counter = 1;
      if (lastRow > 1) {
        const ids = bSheet.getRange(2, BC.BOOKING_ID + 1, lastRow - 1, 1).getValues().flat();
        const prefix = `BK-${year}-`;
        ids.forEach(id => {
          if (String(id).startsWith(prefix)) {
            const n = parseInt(String(id).replace(prefix, ''), 10);
            if (!isNaN(n) && n >= counter) counter = n + 1;
          }
        });
      }
      const bookingId = `BK-${year}-${String(counter).padStart(3, '0')}`;

      const row = new Array(BC._TOTAL_COLS).fill('');
      row[BC.TIMESTAMP]       = new Date().toISOString();
      row[BC.BOOKING_ID]      = bookingId;
      row[BC.STATUS]          = 'Pending';
      row[BC.NAME]            = data.name.trim();
      row[BC.EMAIL]           = data.email.trim();
      row[BC.PHONE]           = data.phone.trim();
      row[BC.EVENT_NAME]      = data.event_name.trim();
      row[BC.EVENT_DATE]      = data.event_date.trim();
      row[BC.EVENT_END_DATE]  = (data.event_end_date || '').trim();
      row[BC.START_TIME]      = (data.start_time || '').trim();
      row[BC.END_TIME]        = (data.end_time || '').trim();
      row[BC.ATTENDANCE]      = (data.attendance || '').toString().trim();
      row[BC.FACILITIES]      = (data.facilities || '').trim();
      row[BC.REQUESTOR_NOTES] = (data.notes || '').trim();

      bSheet.appendRow(row);

      output.setContent(JSON.stringify({ status: 'ok', bookingId: bookingId }));
      return output;
    }

    // All other actions require a valid token
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

    // ── Booking: update (staff form) ──────────────────────────
    if (data.action === 'booking-update') {
      if (!data.booking_id) {
        output.setContent(JSON.stringify({ status: 'error', message: 'Missing field: booking_id' }));
        return output;
      }

      const ss     = SpreadsheetApp.openById(SHEET_ID);
      const bSheet = ss.getSheetByName(BOOKING_TAB_NAME);
      if (!bSheet) {
        output.setContent(JSON.stringify({ status: 'error', message: `Sheet tab "${BOOKING_TAB_NAME}" not found.` }));
        return output;
      }

      // Find the row with this BookingID (column B)
      const lastRow = bSheet.getLastRow();
      if (lastRow < 2) {
        output.setContent(JSON.stringify({ status: 'error', message: 'Booking not found.' }));
        return output;
      }
      const ids       = bSheet.getRange(2, BC.BOOKING_ID + 1, lastRow - 1, 1).getValues().flat();
      const rowIndex  = ids.findIndex(id => id === data.booking_id);
      if (rowIndex === -1) {
        output.setContent(JSON.stringify({ status: 'error', message: `Booking ${data.booking_id} not found.` }));
        return output;
      }
      const sheetRow = rowIndex + 2; // +1 for header, +1 for 1-based index

      // Update only the staff fields present in the payload
      for (const [key, colIndex] of Object.entries(STAFF_FIELDS)) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          bSheet.getRange(sheetRow, colIndex + 1).setValue(data[key]);
        }
      }

      // Always stamp last-updated
      bSheet.getRange(sheetRow, BC.LAST_UPDATED + 1).setValue(new Date().toISOString());
      if (data.updated_by) {
        bSheet.getRange(sheetRow, BC.LAST_UPDATED_BY + 1).setValue(data.updated_by);
      }

      output.setContent(JSON.stringify({ status: 'ok', message: 'Booking updated.' }));
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
      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        // Non-owner callers may lack permission to change sharing on a file
        // created in someone else's folder. The file still inherits the
        // folder's sharing, so don't block post creation over this.
      }
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

// ── GET: health check + optional booking list ─────────────────
// ?action=bookings&token=... returns all HallBookings rows as JSON.
// No token / wrong token returns the standard version string.
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  if (params.action === 'bookings' && params.token === SHARED_TOKEN) {
    try {
      const ss     = SpreadsheetApp.openById(SHEET_ID);
      const bSheet = ss.getSheetByName(BOOKING_TAB_NAME);
      if (!bSheet || bSheet.getLastRow() < 2) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok', bookings: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = bSheet.getRange(2, 1, bSheet.getLastRow() - 1, BC._TOTAL_COLS).getValues();
      const keys = Object.keys(BC).filter(k => k !== '_TOTAL_COLS');

      // Build array of objects using BC key names as property names (lowercased)
      const bookings = rows.map(row => {
        const obj = {};
        keys.forEach(k => { obj[k.toLowerCase()] = row[BC[k]]; });
        return obj;
      });

      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', bookings: bookings }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Default: version string
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', service: 'BS34 Endpoint v4' }))
    .setMimeType(ContentService.MimeType.JSON);
}

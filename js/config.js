/**
 * FIREHALL SITE CONFIGURATION
 * Edit this file to connect your Google resources.
 *
 * HOW TO GET THESE VALUES:
 *
 * GOOGLE_API_KEY:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project → Enable "Google Sheets API" and "Google Drive API"
 *   3. Credentials → Create API Key → restrict to your domain
 *
 * SPREADSHEET_ID:
 *   Open your Google Sheet → the long string in the URL:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 *
 * DRIVE_FOLDER_IDs:
 *   Open a Drive folder → the ID is the last segment of the URL:
 *   https://drive.google.com/drive/folders/FOLDER_ID
 *
 * CALENDAR_ID:
 *   Google Calendar → Settings → scroll to "Integrate calendar" → Calendar ID
 *   Usually looks like: abc123@group.calendar.google.com
 *   Or use your email for your personal calendar.
 */

const CONFIG = {
  GOOGLE_API_KEY: "AIzaSyBa1_oFkcarJA6wZRTSw0mm5r3eFyUTsac",
  // The main content spreadsheet
  SPREADSHEET_ID: "1jlcWZnge9bEFGr0GIK2FfgYfcXLS5WtNkZXNKINYryw",

  // Sheet tab names inside the spreadsheet
  SHEETS: {
    NOTICES:   "Notices",
    MEETINGS:  "FireDept",
    PROJECTS:  "Projects",
    COMMUNITY: "Community",
  },

  // Drive folder IDs — one per section
  DRIVE_FOLDERS: {
    MINUTES:  "1UpvbAHhwL-PiGX7Wy-3xl4NLUxY2DDOM",
    PROJECTS: "1nII7pqZ-2EDtFu-Yk4C6ks58A-r3SBwT",
    GENERAL:  "1_z8XoK31ziDt-ekBPRKyLj0LHaBwtn3e",
    PHOTOS:   "1Tp_KouXrCjeLSFq-40dtwxvNtzvKMres",
  },

  // Google Calendar ID
  CALENDAR_ID: "6b0ea6f3876b6821ba60b35c25bc35e30ea09ec19de7d586fb4599681f28fd03@group.calendar.google.com",

  // Site branding
  SITE: {
    HALL_NAME:  "Boisdale Station 34",
    HALL_SHORT: "Boisdale VFD",
    ADDRESS:    "3810 Grand Narrows Highway, Boisdale, Nova Scotia",
    PHONE:      "(902) 555-0100",
    EMAIL:      "boisdalevfd@gmail.com",
    // Colors (CSS hex)
    COLOR_PRIMARY: "#1a5c2a",   // dark green
    COLOR_DARK:    "#1a1a1a",
    COLOR_LIGHT:   "#f8f5f0",
  },
};

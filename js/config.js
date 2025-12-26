// config.js - Configuration file
const CONFIG = {
  SPREADSHEET_ID: "1Vi5lm1gLomDvQf4waDiR1qB9HjBZScNkbWZkix1vdS8",
  SHEET_NAME: "DATAPASIEN",
  CLIENT_ID:
    "234199179091-tpskpklvaai2vcsq47ngc9ci68v1ns88.apps.googleusercontent.com",
  API_KEY: "AIzaSyAhF8Z68x7r-NMaAqRUwx8N_4yCG0Vp6tE",
  SCOPES: "https://www.googleapis.com/auth/spreadsheets",

  // Public API endpoints
  //   PUBLIC_API_ENDPOINTS: [
  //     `https://opensheet.elk.sh/{SPREADSHEET_ID}/{SHEET_NAME}`,
  //     `https://api.steinhq.com/v1/storages/{SPREADSHEET_ID}/{SHEET_NAME}`,
  //   ],
};

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}

// Google Sheets REST API Module
class SheetsAPI {
  constructor() {
    this.SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
    this.SHEET_NAME = CONFIG.SHEET_NAME;
    this.accessToken = null;
    this.API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
  }

  // Set access token setelah login
  setAccessToken(token) {
    this.accessToken = token;
    console.log("Access token set");
  }

  // Get data dari spreadsheet
  async getData(range = "A2:I") {
    try {
      // Jika ada access token, gunakan authenticated request
      if (this.accessToken) {
        console.log("Using authenticated access");
        return await this.getDataAuthenticated(range);
      } else {
        // Gunakan public access atau API key
        console.log("Using public access");
        return await this.getDataPublic(range);
      }
    } catch (error) {
      console.error("Error getting data:", error);
      throw error;
    }
  }

  // Get data dengan authenticated request
  async getDataAuthenticated(range) {
    const url = `${this.API_BASE}/${this.SPREADSHEET_ID}/values/${this.SHEET_NAME}!${range}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      // Handle token expired
      if (response.status === 401) {
        // console.log("Token expired during API call (401)");

        // Notify auth module
        if (typeof auth !== "undefined") {
          auth.handleTokenExpired();
        }

        throw new Error("Token expired. Silakan login kembali.");
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.values || [];
    } catch (error) {
      console.error("Fetch error:", error);

      // Jika error karena token, clear session
      if (
        error.message.includes("Token expired") ||
        error.message.includes("401")
      ) {
        if (typeof auth !== "undefined") {
          auth.clearExpiredSession();
        }
      }

      throw error;
    }
  }

  // Get data dengan public access
  async getDataPublic(range) {
    // console.log("Trying public access methods...");

    // Metode 1: Menggunakan API key
    try {
      const url = `${this.API_BASE}/${this.SPREADSHEET_ID}/values/${this.SHEET_NAME}!${range}?key=${CONFIG.API_KEY}`;
      //   console.log("Trying API key method:", url);

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        // console.log(
        //   "API key method successful:",
        //   data.values ? data.values.length : 0,
        //   "rows"
        // );
        return data.values || [];
      }
    } catch (error) {
      console.log("API key method failed:", error.message);
    }

    // Metode 2: Menggunakan public JSON endpoint
    try {
      const publicUrl = `https://opensheet.elk.sh/${this.SPREADSHEET_ID}/${this.SHEET_NAME}`;
      //   console.log("Trying public JSON:", publicUrl);

      const response = await fetch(publicUrl);

      if (response.ok) {
        const data = await response.json();
        // console.log("Public JSON method successful:", data.length, "rows");
        return this.convertJsonToArray(data);
      }
    } catch (error) {
      console.log("Public JSON method failed:", error.message);
    }

    // Metode 3: Alternatif public API
    try {
      const altUrl = `https://api.steinhq.com/v1/storages/${this.SPREADSHEET_ID}/${this.SHEET_NAME}`;
      //   console.log("Trying alternative API:", altUrl);

      const response = await fetch(altUrl);

      if (response.ok) {
        const data = await response.json();
        // console.log("Alternative API successful:", data.length, "rows");
        return this.convertJsonToArray(data);
      }
    } catch (error) {
      console.log("Alternative API failed:", error.message);
    }

    throw new Error(
      "Tidak dapat mengakses data spreadsheet. Pastikan spreadsheet sudah dipublikasikan."
    );
  }

  // Convert JSON data ke array format
  convertJsonToArray(jsonData) {
    if (!jsonData || jsonData.length === 0) return [];

    // Ambil keys dari object pertama
    const keys = Object.keys(jsonData[0]);

    // Convert setiap object ke array
    return jsonData.map((item) => {
      return keys.map((key) => {
        const value = item[key];
        return value !== null && value !== undefined ? String(value) : "";
      });
    });
  }

  // Tambah data baru
  async appendData(values) {
    if (!this.accessToken) {
      throw new Error(
        "Authentication required. Silakan login terlebih dahulu."
      );
    }

    const url = `${this.API_BASE}/${this.SPREADSHEET_ID}/values/${this.SHEET_NAME}!A:I:append`;

    const params = {
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
    };

    const fullUrl = `${url}?${new URLSearchParams(params)}`;

    // console.log("Appending data to:", fullUrl);
    // console.log("Data:", values);

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [values],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Append error:", error);
      throw new Error(error.error?.message || "Failed to append data");
    }

    const result = await response.json();
    // console.log("Append successful:", result);
    return result;
  }

  // Update data existing
  async updateData(range, values) {
    if (!this.accessToken) {
      throw new Error(
        "Authentication required. Silakan login terlebih dahulu."
      );
    }

    const url = `${this.API_BASE}/${this.SPREADSHEET_ID}/values/${this.SHEET_NAME}!${range}`;

    const params = {
      valueInputOption: "USER_ENTERED",
    };

    const fullUrl = `${url}?${new URLSearchParams(params)}`;

    // console.log("Updating data at:", fullUrl);
    // console.log("Data:", values);

    const response = await fetch(fullUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [values],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Update error:", error);
      throw new Error(error.error?.message || "Failed to update data");
    }

    const result = await response.json();
    // console.log("Update successful:", result);
    return result;
  }

  // Hapus row
  async deleteRow(rowIndex) {
    if (!this.accessToken) {
      throw new Error(
        "Authentication required. Silakan login terlebih dahulu."
      );
    }

    // Untuk delete row, kita perlu batchUpdate
    const url = `${this.API_BASE}/${this.SPREADSHEET_ID}:batchUpdate`;

    const requestBody = {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0, // Sheet pertama
              dimension: "ROWS",
              startIndex: rowIndex - 1, // Zero-based
              endIndex: rowIndex,
            },
          },
        },
      ],
    };

    // console.log("Deleting row:", rowIndex);
    // console.log("Request body:", requestBody);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Delete error:", error);
      throw new Error(error.error?.message || "Failed to delete row");
    }

    const result = await response.json();
    // console.log("Delete successful:", result);
    return result;
  }
}

// Buat instance global
const sheetsAPI = new SheetsAPI();

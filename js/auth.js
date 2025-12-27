// js/auth.js - Fixed Auth for Write Operations Only
const auth = {
  accessToken: null,
  tokenClient: null,
  googleUser: null,
  isAuthenticated: false,

  // Initialize auth
  init() {
    // console.log("Auth initialized for write operations");
    this.checkExistingLogin();
    // Google Auth akan di-init ketika dibutuhkan
  },

  // Initialize Google Identity Services
  initializeGoogleAuth() {
    return new Promise((resolve, reject) => {
      try {
        // console.log("Initializing Google Auth...");

        // Pastikan GSI sudah loaded
        if (
          typeof google === "undefined" ||
          !google.accounts ||
          !google.accounts.oauth2
        ) {
          //   console.log("Google Identity Services not loaded yet, retrying...");
          setTimeout(
            () => this.initializeGoogleAuth().then(resolve).catch(reject),
            500
          );
          return;
        }

        // Initialize token client
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.CLIENT_ID, // Menggunakan CONFIG dari index.html
          scope: CONFIG.SCOPES,
          callback: (response) => {
            // console.log("Token response received");
            this.handleTokenResponse(response);
            resolve();
          },
          error_callback: (error) => {
            console.error("Google Auth error:", error);
            reject(error);
          },
        });

        // console.log("Google Auth initialized successfully");
        resolve();
      } catch (error) {
        console.error("Failed to initialize Google Auth:", error);
        reject(error);
      }
    });
  },

  // Handle token response
  async handleTokenResponse(response) {
    try {
      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.access_token) {
        throw new Error("No access token received");
      }

      // Simpan access token
      this.accessToken = response.access_token;
      this.isAuthenticated = true;

      // Simpan expiry time jika ada
      if (response.expires_in) {
        const expiryTime = Date.now() + response.expires_in * 1000;
        localStorage.setItem("token_expiry", expiryTime.toString());
        console.log("Token expires at:", new Date(expiryTime));

        // Schedule auto-refresh
        this.scheduleTokenRefresh(response.expires_in - 300); // Refresh 5 menit sebelum expired
      }

      // Simpan ke localStorage
      localStorage.setItem("google_access_token", this.accessToken);

      // Set token ke SheetsAPI
      sheetsAPI.setAccessToken(this.accessToken);

      // Untuk user info
      if (response.id_token) {
        try {
          this.googleUser = this.decodeJWT(response.id_token);
          localStorage.setItem("google_user", JSON.stringify(this.googleUser));
        } catch (e) {
          console.log("Could not decode user info from id_token");
        }
      }

      // Update UI
      this.updateAuthUI();

      // Show success message
      this.showMessage("Login berhasil! Mode edit sekarang aktif.", "success");

      // Load data dengan authentication
      await loadPatientsData();
    } catch (error) {
      console.error("Login error:", error);
      this.showMessage("Login gagal: " + error.message, "error");
    }
  },

  // Schedule auto token refresh
  scheduleTokenRefresh(secondsUntilRefresh) {
    if (secondsUntilRefresh <= 0) return;

    console.log(`Scheduling token refresh in ${secondsUntilRefresh} seconds`);

    clearTimeout(this.tokenRefreshTimeout);

    this.tokenRefreshTimeout = setTimeout(() => {
      console.log("Auto-refreshing token...");
      this.silentTokenRefresh();
    }, secondsUntilRefresh * 1000);
  },

  // Silent token refresh (tidak ganggu user)
  async silentTokenRefresh() {
    try {
      if (!this.tokenClient) {
        await this.initializeGoogleAuth();
      }

      // Prompt untuk mendapatkan token baru
      // Note: Google Identity Services tidak support silent refresh di frontend
      // User perlu interaksi untuk mendapatkan token baru
      console.log("Token needs refresh, will prompt on next action");

      // Set flag untuk refresh pada action berikutnya
      this.needsTokenRefresh = true;
    } catch (error) {
      console.error("Silent token refresh failed:", error);
    }
  },

  // Handle token expired during operation
  handleTokenExpired() {
    console.log("Token expired detected during operation");

    // Clear session
    this.clearExpiredSession();

    // Show modal atau prompt untuk login kembali
    this.showLoginPrompt();
  },

  // Show login prompt
  showLoginPrompt() {
    // Bisa menggunakan modal Bootstrap
    const modalHtml = `
        <div class="modal fade" id="tokenExpiredModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title text-white">
                            <i class="fas fa-exclamation-triangle me-2"></i>Sesi Berakhir
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>Sesi login Anda telah berakhir. Untuk melanjutkan mengedit data, silakan login kembali.</p>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            Data yang dilihat tetap tersedia dalam mode view-only.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Lanjut View-Only</button>
                        <button type="button" class="btn btn-primary" onclick="auth.login()">
                            <i class="fab fa-google me-2"></i>Login Kembali
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Hapus modal lama jika ada
    const oldModal = document.getElementById("tokenExpiredModal");
    if (oldModal) oldModal.remove();

    // Tambah modal baru
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Tampilkan modal
    const modal = new bootstrap.Modal(
      document.getElementById("tokenExpiredModal")
    );
    modal.show();
  },

  // Decode JWT untuk user info
  decodeJWT(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );

      const data = JSON.parse(jsonPayload);
      return {
        id: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };
    } catch (e) {
      console.error("Error decoding JWT:", e);
      return null;
    }
  },

  // Cek login yang sudah ada
  checkExistingLogin() {
    const savedToken = localStorage.getItem("google_access_token");
    const savedUser = localStorage.getItem("google_user");

    if (savedToken) {
      // VALIDASI: Cek apakah token masih valid
      if (!this.isTokenValid(savedToken)) {
        // console.log("Token expired atau tidak valid, melakukan cleanup...");
        this.clearExpiredSession();
        return;
      }

      this.accessToken = savedToken;
      this.isAuthenticated = true;

      if (savedUser) {
        try {
          this.googleUser = JSON.parse(savedUser);
        } catch (e) {
          console.error("Error parsing saved user:", e);
        }
      }

      sheetsAPI.setAccessToken(this.accessToken);
      this.updateAuthUI();
      // console.log("Existing login found and restored");
    }
  },

  // Validasi apakah token masih valid
  isTokenValid(token) {
    if (!token || token.length < 10) return false;

    try {
      // Method 1: Cek struktur token (JWT)
      // Access token Google biasanya ~180 karakter
      if (token.length < 100 || token.length > 2000) {
        // console.log("Token length invalid:", token.length);
        return false;
      }

      // Method 2: Cek expired dengan decode JWT (jika token adalah ID token)
      // Note: Access token tidak bisa di-decode seperti JWT
      if (token.includes(".")) {
        // Kemungkinan ID token
        try {
          const payload = this.decodeJWTPayload(token);
          if (payload && payload.exp) {
            const expiryTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();

            if (currentTime >= expiryTime) {
              // console.log("Token expired at:", new Date(expiryTime));
              return false;
            }

            // console.log("Token valid until:", new Date(expiryTime));
            return true;
          }
        } catch (e) {
          // Bukan JWT token, lanjut ke metode lain
        }
      }

      // Method 3: Test token dengan API call sederhana
      // Kita akan lakukan ini di background tanpa mengganggu user
      this.testTokenValidity(token);

      // Asumsi valid untuk sementara
      return true;
    } catch (error) {
      console.error("Error validating token:", error);
      return false;
    }
  },

  // Test token dengan API call
  async testTokenValidity(token) {
    // Test token dengan Google Sheets API
    try {
      const testUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?fields=properties.title`;

      const response = await fetch(testUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        console.log("Token invalid (401 Unauthorized)");
        this.clearExpiredSession();
        return false;
      }

      if (response.ok) {
        console.log("Token valid - API test successful");
        return true;
      }

      console.log("Token test returned status:", response.status);
      return response.ok;
    } catch (error) {
      console.log("Token test error (might be network):", error.message);
      // Jangan logout jika network error
      return true;
    }
  },

  // Clear expired session
  clearExpiredSession() {
    console.log("Clearing expired session...");

    this.accessToken = null;
    this.googleUser = null;
    this.isAuthenticated = false;

    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_user");
    localStorage.removeItem("token_expiry"); // Jika ada

    sheetsAPI.setAccessToken(null);

    // Update UI
    this.updateAuthUI();

    // Show message to user
    this.showMessage("Sesi telah berakhir. Silakan login kembali.", "warning");
  },

  // Update authentication UI
  updateAuthUI() {
    const authSection = document.getElementById("authSection");
    const mainContent = document.getElementById("mainContent");

    if (!authSection) return;

    if (this.isAuthenticated) {
      // User sudah login
      authSection.innerHTML = `
        <div class="row align-items-center">
          <div class="col-md-8">
            <h5><i class="fas fa-user-shield me-2"></i>Mode Akses Data</h5>
            <p class="mb-0">
              <span id="authStatus">
                <i class="fas fa-check-circle text-success me-1"></i>
                ${
                  this.googleUser?.email
                    ? `Login sebagai: <strong>${this.googleUser.email}</strong><br>`
                    : ""
                }
                <small class="text-success">Mode <strong>edit penuh</strong> aktif</small>
              </span>
            </p>
          </div>
          <div class="col-md-4 text-end">
            <button id="signoutButton" class="btn btn-outline-danger">
              <i class="fas fa-sign-out-alt me-2"></i>Logout
            </button>
          </div>
        </div>
      `;

      // Show main content
      if (mainContent) {
        mainContent.style.display = "block";
      }

      // Enable edit buttons
      this.toggleEditButtons(true);

      setTimeout(() => {
        const activeTab = document.querySelector(".nav-tabs .nav-link.active");
        if (activeTab && activeTab.id === "layanan-tab") {
          loadServiceStatusData();
        }
      }, 500);

      // Add logout event listener
      setTimeout(() => {
        const signoutBtn = document.getElementById("signoutButton");
        if (signoutBtn) {
          signoutBtn.onclick = () => this.logout();
        }
      }, 100);
    } else {
      // User belum login (view-only mode)
      authSection.innerHTML = `
        <div class="row align-items-center">
          <div class="col-md-8">
            <h5><i class="fas fa-user-shield me-2"></i>Mode Akses Data</h5>
            <p class="mb-0">
              <span id="authStatus">
                <i class="fas fa-info-circle text-info me-1"></i>
                Anda dalam mode <strong class="text-info">view-only</strong><br>
                <small>Login untuk mengedit, menambah, atau menghapus data</small>
              </span>
            </p>
          </div>
          <div class="col-md-4 text-end">
            <button id="loginButton" class="btn btn-primary">
              <i class="fab fa-google me-2"></i>Login google
            </button>
          </div>
        </div>
      `;

      // Show main content
      if (mainContent) {
        mainContent.style.display = "block";
      }

      // Disable edit buttons
      this.toggleEditButtons(false);

      // Add login event listener
      setTimeout(() => {
        const loginBtn = document.getElementById("loginButton");
        if (loginBtn) {
          loginBtn.onclick = () => this.login();
        }
      }, 100);

      // Load data in view-only mode
      loadPatientsData();
    }
  },

  // Toggle edit buttons
  toggleEditButtons(enabled) {
    const buttons = [
      "addPatientButton",
      "savePatientBtn",
      "updatePatientBtn",
      "confirmDeleteBtn",
    ];

    buttons.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = !enabled;
      }
    });

    // Toggle view-only class
    const mainContent = document.getElementById("mainContent");
    if (mainContent) {
      if (enabled) {
        mainContent.classList.remove("view-only");
      } else {
        mainContent.classList.add("view-only");
      }
    }
  },

  // Login function
  async login() {
    try {
      //   console.log("Login initiated");

      // Initialize Google Auth jika belum
      if (!this.tokenClient) {
        await this.initializeGoogleAuth();
      }

      // Request token
      this.tokenClient.requestAccessToken();
    } catch (error) {
      console.error("Login failed:", error);
      this.showMessage("Login gagal: " + error.message, "error");
    }
  },

  // Logout function
  logout() {
    console.log("Logout initiated");

    // Clear refresh timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }

    // Revoke token jika ada
    if (
      this.accessToken &&
      typeof google !== "undefined" &&
      google.accounts &&
      google.accounts.oauth2
    ) {
      google.accounts.oauth2.revoke(this.accessToken, (done) => {
        console.log("Token revoked:", done);
      });
    }

    // Clear semua data
    this.accessToken = null;
    this.tokenClient = null;
    this.googleUser = null;
    this.isAuthenticated = false;
    this.needsTokenRefresh = false;

    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_user");
    localStorage.removeItem("token_expiry");

    sheetsAPI.setAccessToken(null);

    // Update UI
    this.updateAuthUI();
    this.showMessage("Logout berhasil. Kembali ke mode view-only.", "info");
  },

  // Check token sebelum operasi edit
  async checkTokenBeforeOperation() {
    if (!this.isAuthenticated || !this.accessToken) {
      throw new Error("Not authenticated");
    }

    // Quick test token
    const isValid = await this.testTokenValidity(this.accessToken);

    if (!isValid) {
      this.handleTokenExpired();
      throw new Error("Token expired");
    }

    return true;
  },

  // Wrapper untuk operasi edit
  async withTokenValidation(operation) {
    try {
      await this.checkTokenBeforeOperation();
      return await operation();
    } catch (error) {
      if (
        error.message.includes("Token expired") ||
        error.message.includes("401")
      ) {
        this.handleTokenExpired();
      }
      throw error;
    }
  },

  // Check auth status
  checkAuthStatus() {
    return this.isAuthenticated;
  },

  // Show message
  showMessage(message, type = "info") {
    const alertClass =
      {
        success: "alert-success",
        error: "alert-danger",
        info: "alert-info",
        warning: "alert-warning",
      }[type] || "alert-info";

    const messageDiv = document.createElement("div");
    messageDiv.className = `alert ${alertClass} alert-dismissible fade show`;
    messageDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector(".container");
    if (container) {
      container.insertBefore(messageDiv, container.firstChild);

      // Auto remove after 5 seconds
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 5000);
    }
  },
};

// Global functions untuk dipanggil dari HTML
function login() {
  auth.login();
}

function logout() {
  auth.logout();
}

// Initialize auth when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  //   console.log("DOM loaded, initializing auth...");

  // Tunggu Google Identity Services load
  const checkGISLoaded = setInterval(() => {
    if (
      typeof google !== "undefined" &&
      google.accounts &&
      google.accounts.oauth2
    ) {
      clearInterval(checkGISLoaded);
      auth.init();

      // Set default date
      const today = new Date().toISOString().split("T")[0];
      const addDate = document.getElementById("addDate");
      const editDate = document.getElementById("editDate");

      if (addDate) addDate.value = today;
      if (editDate) editDate.value = today;
    }
  }, 500);

  // Timeout setelah 10 detik
  setTimeout(() => {
    clearInterval(checkGISLoaded);
    if (!auth.tokenClient) {
      //   console.log("Google Identity Services not loaded, using view-only mode");
      auth.updateAuthUI();
    }
  }, 10000);
});

// Export untuk digunakan di file lain
if (typeof module !== "undefined" && module.exports) {
  module.exports = auth;
}

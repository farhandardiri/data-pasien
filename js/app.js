// Main Application Module
let currentRowToDelete = null;
let patientsData = [];
let todayPatientsData = [];
let filteredServiceData = [];

// Initialize application
document.addEventListener("DOMContentLoaded", function () {
  // console.log("🚀 App initializing...");

  // Set tanggal default
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("addDate").value = today;
  document.getElementById("editDate").value = today;

  // Tampilkan tanggal hari ini di tab Status Layanan
  document.getElementById("todayDate").textContent =
    formatDateForDisplay(today);

  // Setup event listeners
  setupEventListeners();
  setupServiceTabListeners();
  setupGlobalSearch();
  setupTabSwitchListeners();

  // LOAD DATA AWAL
  // console.log("📥 Loading initial data...");
  setTimeout(() => {
    loadPatientsData().then(() => {
      // console.log("✅ Initial data loaded");

      // Cek apakah tab layanan aktif saat pertama load
      const activeTab = document.querySelector(".nav-tabs .nav-link.active");
      if (activeTab && activeTab.id === "layanan-tab") {
        // console.log("📋 Tab layanan aktif, loading service data...");
        loadServiceStatusData();
      }
    });
  }, 1500); // Beri waktu untuk Google API load

  // console.log("🎯 App initialized");
});

// FUNGSI BARU: Setup listeners untuk tab Status Layanan
function setupServiceTabListeners() {
  // Filter radio buttons
  document.querySelectorAll('input[name="serviceFilter"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      filterServiceTable(this.id);
    });
  });

  // Search button di tab Status Layanan
  document
    .getElementById("searchServiceButton")
    ?.addEventListener("click", searchServiceTable);
  document
    .getElementById("searchServiceInput")
    ?.addEventListener("keypress", function (e) {
      if (e.key === "Enter") searchServiceTable();
    });

  // Remind button
  document
    .getElementById("remindButton")
    ?.addEventListener("click", remindUnservedPatients);

  // Tab show event
  document
    .getElementById("layanan-tab")
    ?.addEventListener("shown.bs.tab", function () {
      loadServiceStatusData();
    });
}

// FUNGSI BARU: Load data untuk tab Status Layanan (DIPERBAIKI)
function loadServiceStatusData() {
  if (!patientsData || patientsData.length === 0) {
    console.log("No patient data available for service status");
    const tableBody = document.getElementById("serviceStatusTableBody");
    if (tableBody) {
      tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Data pasien belum dimuat.
                    </td>
                </tr>
            `;
    }
    return;
  }

  // Format: YYYY-MM-DD
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0]; // 2025-12-26
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  // Format alternatif untuk matching
  const todayDDMMYYYY = `${String(todayDay).padStart(2, "0")}/${String(
    todayMonth
  ).padStart(2, "0")}/${todayYear}`; // 26/12/2025
  const todayDDMMYY = `${String(todayDay).padStart(2, "0")}/${String(
    todayMonth
  ).padStart(2, "0")}/${String(todayYear).slice(-2)}`; // 26/12/25

  // // DEBUG: Tampilkan format yang dicari
  // console.log("Mencari tanggal:", {
  //   "YYYY-MM-DD": todayStr,
  //   "DD/MM/YYYY": todayDDMMYYYY,
  //   "DD/MM/YY": todayDDMMYY,
  // });

  // Filter pasien hari ini - PERBAIKAN UTAMA
  todayPatientsData = patientsData.filter((patient) => {
    if (!patient || patient.length < 2) return false;

    const patientDate = patient[1]; // Kolom tanggal

    if (!patientDate || patientDate.trim() === "") return false;

    // Bersihkan string tanggal
    const cleanDate = patientDate.toString().trim();

    // Cek berbagai format tanggal

    // Format 1: DD/MM/YY (18/12/25)
    if (cleanDate.includes("/")) {
      const parts = cleanDate.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        let year = parseInt(parts[2]);

        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year += 2000; // Asumsi tahun 2000+
        }

        // Compare with today
        return day === todayDay && month === todayMonth && year === todayYear;
      }
    }

    // Format 2: DD/MM/YYYY (18/12/2025)
    if (cleanDate.includes("/")) {
      const parts = cleanDate.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);

        return day === todayDay && month === todayMonth && year === todayYear;
      }
    }

    // Format 3: YYYY-MM-DD (2025-12-18)
    if (cleanDate.includes("-")) {
      const datePart = cleanDate.split("T")[0];
      const parts = datePart.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);

        return day === todayDay && month === todayMonth && year === todayYear;
      }
    }

    // Format 4: Timestamp atau Date object
    try {
      const dateObj = new Date(cleanDate);
      if (!isNaN(dateObj.getTime())) {
        const patientDay = dateObj.getDate();
        const patientMonth = dateObj.getMonth() + 1;
        const patientYear = dateObj.getFullYear();

        return (
          patientDay === todayDay &&
          patientMonth === todayMonth &&
          patientYear === todayYear
        );
      }
    } catch (e) {
      // Skip error
    }

    return false;
  });

  // Update counters
  updateServiceCounters();

  // Display table
  displayServiceStatusTable(todayPatientsData);

  // Update summary lists
  updateSummaryLists();
}

// FUNGSI BARU: Update counter di tab Status Layanan
function updateServiceCounters() {
  // console.log("🔢 Updating service counters...");
  // console.log("📈 Total pasien hari ini:", todayPatientsData.length);

  if (!todayPatientsData || todayPatientsData.length === 0) {
    // console.log("📭 No patients today, resetting counters");
    document.getElementById("totalToday").textContent = "0";
    document.getElementById("servedCount").textContent = "0";
    document.getElementById("notServedCount").textContent = "0";
    return;
  }

  let servedCount = 0;
  let notServedCount = 0;

  todayPatientsData.forEach((patient, index) => {
    const therapy = patient[7] || ""; // Kolom terapi (index 7)
    const hasTherapy = therapy.toString().trim().length > 0;

    if (hasTherapy) {
      servedCount++;
      // console.log(
      //   `✅ Pasien ${index + 1}: "${
      //     patient[2]
      //   }" - Sudah dilayani (terapi: "${therapy}")`
      // );
    } else {
      notServedCount++;
      // console.log(`⏳ Pasien ${index + 1}: "${patient[2]}" - Belum dilayani`);
    }
  });

  // console.log(`📊 Hasil: ${servedCount} dilayani, ${notServedCount} belum`);

  document.getElementById("totalToday").textContent = todayPatientsData.length;
  document.getElementById("servedCount").textContent = servedCount;
  document.getElementById("notServedCount").textContent = notServedCount;
}

// FUNGSI BARU: Display table di tab Status Layanan
function displayServiceStatusTable(data) {
  const tableBody = document.getElementById("serviceStatusTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!data || data.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    <i class="fas fa-calendar-day fa-2x mb-3 d-block"></i>
                    Tidak ada pasien terdaftar untuk hari ini.
                </td>
            </tr>
        `;
    return;
  }

  // Simpan data yang difilter untuk pencarian
  filteredServiceData = data;

  data.forEach((patient, index) => {
    const isServed = patient[7] && patient[7].trim().length > 0;
    const statusClass = isServed ? "status-served" : "status-not-served";
    const statusText = isServed ? "Sudah Dilayani" : "Belum Dilayani";
    const statusIcon = isServed ? "fa-check-circle" : "fa-clock";

    // Format waktu
    const patientTime = patient[1] ? formatTimeFromDate(patient[1]) : "-";

    const tableRow = document.createElement("tr");
    // <td>${patientTime}</td>
    tableRow.innerHTML = `
            <td>${escapeHtml(patient[0] || "")}</td>
            <td><strong>${escapeHtml(patient[2] || "")}</strong></td>
            <td>${escapeHtml(patient[5] || "")} thn</td>
            <td>${escapeHtml(patient[6] || "")}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    <i class="fas ${statusIcon} me-1"></i>${statusText}
                </span>
            </td>
            <td>
                ${
                  isServed
                    ? `<span class="text-success"><i class="fas fa-check me-1"></i>${escapeHtml(
                        patient[7] || ""
                      )}</span>`
                    : '<span class="text-muted fst-italic">Belum ada terapi</span>'
                }
            </td>
            <td class="action-buttons">
                ${
                  !isServed && checkAuthStatus()
                    ? `
                <button class="btn btn-sm btn-outline-success service-action-btn mark-served-btn" data-index="${index}">
                    <i class="fas fa-check me-1"></i>Tandai Selesai
                </button>
                `
                    : ""
                }
                <button class="btn btn-sm btn-outline-primary service-action-btn view-detail-btn" data-index="${index}">
                    <i class="fas fa-eye me-1"></i>Detail
                </button>
            </td>
        `;
    tableBody.appendChild(tableRow);
  });

  // Add event listeners untuk tombol aksi
  document.querySelectorAll(".mark-served-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));
      markPatientAsServed(index);
    });
  });

  document.querySelectorAll(".view-detail-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));
      showPatientDetail(index);
    });
  });
}

// FUNGSI BARU: Filter tabel berdasarkan status
function filterServiceTable(filterId) {
  if (!todayPatientsData.length) return;

  let filteredData = todayPatientsData;

  switch (filterId) {
    case "filterServed":
      filteredData = todayPatientsData.filter(
        (patient) => patient[7] && patient[7].trim().length > 0
      );
      break;
    case "filterNotServed":
      filteredData = todayPatientsData.filter(
        (patient) => !patient[7] || patient[7].trim().length === 0
      );
      break;
    // 'filterAll' tidak melakukan filter
  }

  displayServiceStatusTable(filteredData);
}

// FUNGSI BARU: Pencarian di tab Status Layanan
function searchServiceTable() {
  const searchTerm = document
    .getElementById("searchServiceInput")
    .value.trim()
    .toLowerCase();

  if (!searchTerm) {
    // Reset ke data awal jika search kosong
    const activeFilter = document.querySelector(
      'input[name="serviceFilter"]:checked'
    ).id;
    filterServiceTable(activeFilter);
    return;
  }

  const filteredData = filteredServiceData.filter((patient) => {
    const nama = (patient[2] || "").toString().toLowerCase();
    const noReg = (patient[0] || "").toString().toLowerCase();
    const keluhan = (patient[6] || "").toString().toLowerCase();

    return (
      nama.includes(searchTerm) ||
      noReg.includes(searchTerm) ||
      keluhan.includes(searchTerm)
    );
  });

  displayServiceStatusTable(filteredData);
}

// FUNGSI BARU: Tandai pasien sebagai sudah dilayani
function markPatientAsServed(index) {
  const patient = todayPatientsData[index];

  if (!patient) {
    alert("Data pasien tidak ditemukan");
    return;
  }

  const therapy = prompt(
    `Masukkan terapi yang diberikan untuk ${patient[2] || "pasien"}:`,
    patient[7] || ""
  );

  if (therapy === null) return; // User cancelled

  // Cari index pasien di data utama
  const mainIndex = patientsData.findIndex(
    (p) => p[0] === patient[0] && p[1] === patient[1]
  );

  if (mainIndex === -1) {
    alert("Tidak dapat menemukan data pasien di database");
    return;
  }

  // Update data
  patient[7] = therapy.trim();
  patientsData[mainIndex][7] = therapy.trim();

  // Simpan ke Google Sheets
  updatePatientTherapy(mainIndex, therapy.trim());
}
// FUNGSI BARU: Update terapi pasien
async function updatePatientTherapy(index, therapy) {
  try {
    showLoading(true);

    const rowIndex = index + 2; // Header row + index
    const patient = patientsData[index];

    // Siapkan data yang diperbarui
    const updatedPatient = [
      patient[0] || "", // No Registrasi
      patient[1] || "", // Tanggal
      patient[2] || "", // Nama
      patient[3] || "", // Wali
      patient[4] || "", // Alamat
      patient[5] || "", // Usia
      patient[6] || "", // Keluhan
      therapy, // Terapi (diupdate)
      patient[8] || "", // Keterangan
    ];

    const range = `A${rowIndex}:I${rowIndex}`;

    await sheetsAPI.updateData(range, updatedPatient);

    // Refresh data
    await loadPatientsData();

    // Refresh tab Status Layanan
    loadServiceStatusData();

    showMessage("Terapi berhasil diperbarui!", "success");
  } catch (error) {
    showMessage("Gagal memperbarui terapi: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// FUNGSI BARU: Tampilkan detail pasien
function showPatientDetail(index) {
  const patient = todayPatientsData[index];

  if (!patient) return;

  const modalHtml = `
        <div class="modal fade" id="patientDetailModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-user-injured me-2"></i>Detail Pasien
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>No. Registrasi:</strong><br>${escapeHtml(
                                  patient[0] || ""
                                )}</p>
                                <p><strong>Tanggal:</strong><br>${formatDateForDisplay(
                                  patient[1]
                                )}</p>
                                <p><strong>Nama Lengkap:</strong><br>${escapeHtml(
                                  patient[2] || ""
                                )}</p>
                                <p><strong>Wali/Orang Tua:</strong><br>${escapeHtml(
                                  patient[3] || ""
                                )}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Usia:</strong><br>${escapeHtml(
                                  patient[5] || ""
                                )} tahun</p>
                                <p><strong>Keluhan:</strong><br>${escapeHtml(
                                  patient[6] || ""
                                )}</p>
                                <p><strong>Terapi:</strong><br>
                                    ${
                                      patient[7] && patient[7].trim().length > 0
                                        ? `<span class="text-success">${escapeHtml(
                                            patient[7]
                                          )}</span>`
                                        : '<span class="text-warning fst-italic">Belum dilayani</span>'
                                    }
                                </p>
                                <p><strong>Alamat:</strong><br>${escapeHtml(
                                  patient[4] || ""
                                )}</p>
                            </div>
                        </div>
                        ${
                          patient[8]
                            ? `<hr><p><strong>Keterangan Tambahan:</strong><br>${escapeHtml(
                                patient[8]
                              )}</p>`
                            : ""
                        }
                    </div>
                    <div class="modal-footer">
                        ${
                          !patient[7] || patient[7].trim().length === 0
                            ? `
                        <button type="button" class="btn btn-success" onclick="markPatientAsServed(${index})">
                            <i class="fas fa-check me-1"></i>Tandai Sudah Dilayani
                        </button>
                        `
                            : ""
                        }
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                    </div>
                </div>
            </div>
        </div>
    `;

  // Hapus modal lama jika ada
  const oldModal = document.getElementById("patientDetailModal");
  if (oldModal) oldModal.remove();

  // Tambahkan modal baru
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Tampilkan modal
  const modal = new bootstrap.Modal(
    document.getElementById("patientDetailModal")
  );
  modal.show();
}

// FUNGSI BARU: Update summary lists
function updateSummaryLists() {
  if (!todayPatientsData.length) {
    document.getElementById("servedListTitle").textContent = "0 Pasien";
    document.getElementById("notServedListTitle").textContent = "0 Pasien";
    document.getElementById("servedPatientsList").innerHTML =
      '<p class="text-muted">Tidak ada data</p>';
    document.getElementById("notServedPatientsList").innerHTML =
      '<p class="text-muted">Tidak ada data</p>';
    return;
  }

  // Pasien sudah dilayani
  const servedPatients = todayPatientsData.filter(
    (patient) => patient[7] && patient[7].trim().length > 0
  );

  // Pasien belum dilayani
  const notServedPatients = todayPatientsData.filter(
    (patient) => !patient[7] || patient[7].trim().length === 0
  );

  // Update titles
  document.getElementById(
    "servedListTitle"
  ).textContent = `${servedPatients.length} Pasien`;
  document.getElementById(
    "notServedListTitle"
  ).textContent = `${notServedPatients.length} Pasien`;

  // Update served patients list
  const servedList = document.getElementById("servedPatientsList");
  if (servedPatients.length > 0) {
    let servedHtml = "";
    servedPatients.forEach((patient) => {
      const usia = patient[5] ? `${escapeHtml(patient[5])}` : "-";
      servedHtml += `
                <div class="patient-list-item">
                    <div>
                        <strong>${escapeHtml(patient[2] || "")}</strong>
                        <div class="text-muted small">${escapeHtml(
                          patient[0] || ""
                        )} • ${usia}</div>
                    </div>
                    <span class="badge bg-success">${escapeHtml(
                      patient[7] || ""
                    ).substring(0, 20)}${
        patient[7] && patient[7].length > 20 ? "..." : ""
      }</span>
                </div>
            `;
    });
    servedList.innerHTML = servedHtml;
  } else {
    servedList.innerHTML =
      '<p class="text-muted">Belum ada pasien yang dilayani</p>';
  }

  // Update not served patients list
  // Update not served patients list
  const notServedList = document.getElementById("notServedPatientsList");
  if (notServedPatients.length > 0) {
    let notServedHtml = "";
    notServedPatients.forEach((patient, index) => {
      const usia = patient[5] ? `${escapeHtml(patient[5])}` : "-";
      notServedHtml += `
                <div class="patient-list-item">
                    <div>
                        <strong>${escapeHtml(patient[2] || "")}</strong>
                        <div class="text-muted small">${escapeHtml(
                          patient[0] || ""
                        )} • ${usia}</div>
                    </div>
                    <button class="btn btn-sm btn-outline-success mark-from-list-btn" data-index="${index}">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            `;
    });
    notServedList.innerHTML = notServedHtml;

    // Add event listeners untuk tombol di list
    document.querySelectorAll(".mark-from-list-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const index = parseInt(this.getAttribute("data-index"));
        markPatientAsServed(index);
      });
    });
  } else {
    notServedList.innerHTML =
      '<p class="text-success">Semua pasien sudah dilayani! 🎉</p>';
  }
}

// FUNGSI BARU: Ingatkan pasien belum dilayani
function remindUnservedPatients() {
  const notServedPatients = todayPatientsData.filter(
    (patient) => !patient[7] || patient[7].trim().length === 0
  );

  if (notServedPatients.length === 0) {
    alert("Tidak ada pasien yang belum dilayani hari ini.");
    return;
  }

  const patientNames = notServedPatients
    .map((p) => p[2] || "Pasien")
    .join(", ");

  if (
    confirm(
      `Ada ${notServedPatients.length} pasien yang belum dilayani:\n${patientNames}\n\nIngatkan untuk dilayani sekarang?`
    )
  ) {
    // Bisa ditambahkan fitur notifikasi/reminder di sini
    showMessage(
      `Pengingat: ${notServedPatients.length} pasien belum dilayani`,
      "warning"
    );

    // Auto-switch to not served filter
    document.getElementById("filterNotServed").checked = true;
    filterServiceTable("filterNotServed");
  }
}

// FUNGSI BARU: Format time dari date string
function formatTimeFromDate(dateString) {
  if (!dateString) return "-";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // Coba format tanpa timezone
      const timePart = dateString.split("T")[1];
      if (timePart) {
        const time = timePart.substring(0, 5);
        return time;
      }
      return "-";
    }
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (e) {
    return dateString.substring(11, 16) || "-";
  }
}

// FUNGSI BARU: Konversi tanggal dari format spreadsheet ke YYYY-MM-DD
function convertSpreadsheetDate(spreadsheetDate) {
  if (!spreadsheetDate || spreadsheetDate.trim() === "") return "";

  const dateStr = spreadsheetDate.toString().trim();

  try {
    // Format DD/MM/YY atau DD/MM/YYYY
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]);
        let year = parseInt(parts[2]);

        // Convert 2-digit year to 4-digit
        if (year < 100) {
          year += 2000;
        }

        // Format to YYYY-MM-DD
        return `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
      }
    }

    // Format YYYY-MM-DD (sudah benar)
    if (dateStr.includes("-")) {
      return dateStr.split("T")[0];
    }

    // Try parsing as Date object
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split("T")[0];
    }

    return dateStr; // Return as is if can't parse
  } catch (error) {
    console.log("Error converting date:", dateStr, error);
    return dateStr;
  }
}

// FUNGSI BARU: Format tanggal untuk display
function formatDateForDisplay(spreadsheetDate) {
  const convertedDate = convertSpreadsheetDate(spreadsheetDate);

  if (!convertedDate) return "-";

  try {
    const dateObj = new Date(convertedDate);
    if (isNaN(dateObj.getTime())) return convertedDate;

    return dateObj.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return convertedDate;
  }
}

// FUNGSI BARU: Format tanggal untuk input date (YYYY-MM-DD)
function formatDateForInput(spreadsheetDate) {
  return convertSpreadsheetDate(spreadsheetDate);
}

function checkAuthStatus() {
  return auth.isAuthenticated;
}

// FUNGSI BARU: Setup listeners untuk tab switching
function setupTabSwitchListeners() {
  const tabLinks = document.querySelectorAll(
    '#myTab button[data-bs-toggle="tab"]'
  );

  tabLinks.forEach((tab) => {
    tab.addEventListener("shown.bs.tab", function (event) {
      const targetId = event.target.getAttribute("data-bs-target");
      // console.log(`🔀 Tab switched to: ${targetId}`);

      // Jika switch ke tab layanan, refresh data
      if (targetId === "#status-layanan") {
        // console.log("🔄 Refreshing service status data...");
        setTimeout(() => {
          loadServiceStatusData();
        }, 300);
      }

      // Jika switch ke tab semua pasien, refresh jika perlu
      if (targetId === "#data-pasien") {
        // console.log("🔄 Tab semua pasien aktif");
        // Data sudah di-load, tidak perlu refresh
      }
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  //   console.log("Setting up event listeners...");

  // Save new patient
  document
    .getElementById("savePatientBtn")
    ?.addEventListener("click", saveNewPatient);

  // Update patient
  document
    .getElementById("updatePatientBtn")
    ?.addEventListener("click", updateExistingPatient);

  // Confirm delete
  document
    .getElementById("confirmDeleteBtn")
    ?.addEventListener("click", deleteExistingPatient);

  // Search patient
  document
    .getElementById("searchButton")
    ?.addEventListener("click", searchPatient);
  document
    .getElementById("searchInput")
    ?.addEventListener("keypress", function (e) {
      if (e.key === "Enter") searchPatient();
    });

  // Modal close events
  const addModal = document.getElementById("addPatientModal");
  if (addModal) {
    addModal.addEventListener("hidden.bs.modal", function () {
      document.getElementById("addPatientForm").reset();
      document.getElementById("addDate").value = new Date()
        .toISOString()
        .split("T")[0];
    });
  }

  const editModal = document.getElementById("editPatientModal");
  if (editModal) {
    editModal.addEventListener("hidden.bs.modal", function () {
      currentRowToDelete = null;
    });
  }
}

// FUNGSI BARU: Tambah pencarian di tab Semua Pasien
function setupGlobalSearch() {
  // Buat search box di tab Semua Pasien
  const dataHeader = document.querySelector("#data-pasien .data-header");
  if (dataHeader) {
    const searchHtml = `
            <div class="row mt-3">
                <div class="col-md-6">
                    <div class="input-group">
                        <input type="text" id="globalSearchInput" class="form-control" 
                               placeholder="Cari nama, no. registrasi, atau keluhan...">
                        <button class="btn btn-outline-primary" type="button" id="globalSearchButton">
                            <i class="fas fa-search"></i>
                        </button>
                        <button class="btn btn-outline-secondary" type="button" id="clearSearchButton">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="col-md-6 text-end">
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="checkbox" id="filterTodayOnly">
                        <label class="form-check-label" for="filterTodayOnly">
                            Tampilkan hari ini saja
                        </label>
                    </div>
                </div>
            </div>
        `;

    dataHeader.insertAdjacentHTML("afterend", searchHtml);

    // Add event listeners
    document
      .getElementById("globalSearchButton")
      ?.addEventListener("click", performGlobalSearch);
    document
      .getElementById("clearSearchButton")
      ?.addEventListener("click", clearGlobalSearch);
    document
      .getElementById("globalSearchInput")
      ?.addEventListener("keypress", function (e) {
        if (e.key === "Enter") performGlobalSearch();
      });
    document
      .getElementById("filterTodayOnly")
      ?.addEventListener("change", performGlobalSearch);
  }
}

// FUNGSI BARU: Global search function
function performGlobalSearch() {
  const searchTerm = document
    .getElementById("globalSearchInput")
    .value.trim()
    .toLowerCase();
  const filterToday =
    document.getElementById("filterTodayOnly")?.checked || false;
  const today = new Date().toISOString().split("T")[0];

  let filteredData = patientsData;

  // Filter by date if needed
  if (filterToday) {
    filteredData = patientsData.filter((patient) => {
      const patientDate = patient[1] ? patient[1].split("T")[0] : "";
      return patientDate === today;
    });
  }

  // Filter by search term
  if (searchTerm) {
    filteredData = filteredData.filter((patient) => {
      const nama = (patient[2] || "").toString().toLowerCase();
      const noReg = (patient[0] || "").toString().toLowerCase();
      const keluhan = (patient[6] || "").toString().toLowerCase();
      const alamat = (patient[4] || "").toString().toLowerCase();
      const terapi = (patient[7] || "").toString().toLowerCase();

      return (
        nama.includes(searchTerm) ||
        noReg.includes(searchTerm) ||
        keluhan.includes(searchTerm) ||
        alamat.includes(searchTerm) ||
        terapi.includes(searchTerm)
      );
    });
  }

  // Display filtered results
  displayPatientsTable(filteredData);

  // Update total count
  document.getElementById("totalPatients").textContent = filteredData.length;

  // Show filter status
  if (searchTerm || filterToday) {
    showMessage(
      `Menampilkan ${filteredData.length} hasil${
        searchTerm ? ` untuk "${searchTerm}"` : ""
      }${filterToday ? " (hanya hari ini)" : ""}`,
      "info"
    );
  }
}

// FUNGSI BARU: Clear search
function clearGlobalSearch() {
  document.getElementById("globalSearchInput").value = "";
  if (document.getElementById("filterTodayOnly")) {
    document.getElementById("filterTodayOnly").checked = false;
  }
  displayPatientsTable(patientsData);
  document.getElementById("totalPatients").textContent = patientsData.length;
}

// Tambahkan kode debugging sederhana di app.js
async function loadPatientsData() {
  try {
    showLoading(true);

    const data = await sheetsAPI.getData("A2:I");
    patientsData = data;

    displayPatientsTable(patientsData);

    // Refresh tab Status Layanan jika aktif
    const activeTab = document.querySelector(".nav-tabs .nav-link.active");
    if (activeTab && activeTab.id === "layanan-tab") {
      loadServiceStatusData();
    }
  } catch (error) {
    console.error("Error loading patients:", error);
    displayError("Gagal memuat data: " + error.message);
  } finally {
    showLoading(false);
  }
}

// Display patients in table
function displayPatientsTable(data) {
  const tableBody = document.getElementById("patientTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!data || data.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted py-4">
                    <i class="fas fa-user-injured fa-2x mb-3 d-block"></i>
                    Belum ada data pasien.
                </td>
            </tr>
        `;
    document.getElementById("totalPatients").textContent = "0";
    return;
  }

  // Update total patients count
  document.getElementById("totalPatients").textContent = data.length;

  data.forEach((row, index) => {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
            <td>${escapeHtml(row[0] || "")}</td>
          <td>${formatDateForDisplay(row[1])}</td>
            <td><strong>${escapeHtml(row[2] || "")}</strong></td>
            <td>${escapeHtml(row[3] || "")}</td>
            <td>${escapeHtml(row[4] || "")}</td>
            <td>${escapeHtml(row[5] || "")}</td>
            <td>${escapeHtml(row[6] || "")}</td>
            <td>${escapeHtml(row[7] || "")}</td>
            <td>${escapeHtml(row[8] || "")}</td>
            <td class="action-buttons">
                <button class="btn btn-sm btn-outline-primary edit-btn" data-index="${index}" 
                    ${!checkAuthStatus() ? "disabled" : ""}>
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-index="${index}"
                    ${!checkAuthStatus() ? "disabled" : ""}>
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    tableBody.appendChild(tableRow);
  });

  // Add event listeners to action buttons
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      if (!checkAuthStatus()) {
        alert("Silakan login terlebih dahulu untuk mengedit data");
        return;
      }
      const index = parseInt(this.getAttribute("data-index"));
      editPatient(index);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      if (!checkAuthStatus()) {
        alert("Silakan login terlebih dahulu untuk menghapus data");
        return;
      }
      const index = parseInt(this.getAttribute("data-index"));
      confirmDeletePatient(index);
    });
  });
}

// Save new patient
async function saveNewPatient() {
  try {
    if (!validatePatientForm("add")) {
      showMessage("Harap isi semua kolom wajib", "warning");
      return;
    }

    // CEK TOKEN sebelum operasi
    if (!(await auth.checkTokenBeforeOperation())) {
      return; // Akan dihandle oleh auth module
    }

    const patientData = [
      document.getElementById("addRegNumber").value.trim(),
      document.getElementById("addDate").value, // Format: YYYY-MM-DD
      document.getElementById("addFullName").value.trim(),
      document.getElementById("addParent").value.trim(),
      document.getElementById("addAddress").value.trim(),
      document.getElementById("addAge").value,
      document.getElementById("addComplaint").value.trim(),
      document.getElementById("addTherapy").value.trim(),
      document.getElementById("addNotes").value.trim(),
    ];

    // console.log("➕ Menambahkan data baru:", patientData);

    showLoading(true);

    await sheetsAPI.appendData(patientData);

    // Tutup modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addPatientModal")
    );
    modal.hide();

    // Reset form
    document.getElementById("addPatientForm").reset();
    document.getElementById("addDate").value = new Date()
      .toISOString()
      .split("T")[0];

    // console.log("🔄 Memuat ulang data...");

    // MUAT ULANG DATA DENGAN CARA YANG BENAR
    await loadPatientsData(); // Ini akan refresh semua data

    // TUNGGU SEBENTAR lalu refresh tab layanan
    setTimeout(() => {
      const activeTab = document.querySelector(".nav-tabs .nav-link.active");
      // console.log("📍 Tab aktif:", activeTab?.id);

      if (
        activeTab &&
        (activeTab.id === "layanan-tab" || activeTab.id === "data-tab")
      ) {
        // console.log("🔄 Refresh tab aktif");
        if (activeTab.id === "layanan-tab") {
          loadServiceStatusData();
        }
        // Tab data-tab sudah di-refresh oleh loadPatientsData()
      }
    }, 1000);

    showMessage("Data pasien berhasil ditambahkan!", "success");
  } catch (error) {
    if (error.message.includes("Token expired")) {
      // Sudah dihandle oleh auth module
      return;
    }
    console.error("❌ Error adding patient:", error);
    showMessage("Gagal menambah data: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// FUNGSI: Edit patient (DIPERBAIKI)
function editPatient(index) {
  const patient = patientsData[index];

  if (!patient) {
    alert("Data tidak ditemukan");
    return;
  }

  // Row index untuk update (A2 = row 2)
  const rowIndex = index + 2;

  document.getElementById("editRowIndex").value = rowIndex;
  document.getElementById("editRegNumber").value = patient[0] || "";

  // KONVERSI TANGGAL DARI SPREADSHEET KE FORMAT INPUT
  document.getElementById("editDate").value =
    formatDateForInput(patient[1]) || "";

  document.getElementById("editFullName").value = patient[2] || "";
  document.getElementById("editParent").value = patient[3] || "";
  document.getElementById("editAddress").value = patient[4] || "";
  document.getElementById("editAge").value = patient[5] || "";
  document.getElementById("editComplaint").value = patient[6] || "";
  document.getElementById("editTherapy").value = patient[7] || "";
  document.getElementById("editNotes").value = patient[8] || "";

  // Show modal
  const modal = new bootstrap.Modal(
    document.getElementById("editPatientModal")
  );
  modal.show();
}

// Update patient
async function updateExistingPatient() {
  try {
    // Validate form
    if (!validatePatientForm("edit")) {
      alert("Harap isi semua kolom yang wajib diisi!");
      return;
    }

    const rowIndex = document.getElementById("editRowIndex").value;
    const range = `A${rowIndex}:I${rowIndex}`;

    const patientData = [
      document.getElementById("editRegNumber").value.trim(),
      document.getElementById("editDate").value,
      document.getElementById("editFullName").value.trim(),
      document.getElementById("editParent").value.trim(),
      document.getElementById("editAddress").value.trim(),
      document.getElementById("editAge").value,
      document.getElementById("editComplaint").value.trim(),
      document.getElementById("editTherapy").value.trim(),
      document.getElementById("editNotes").value.trim(),
    ];

    showLoading(true);

    await sheetsAPI.updateData(range, patientData);

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("editPatientModal")
    );
    modal.hide();

    // Reload data
    await loadPatientsData();

    showMessage("Data pasien berhasil diperbarui!", "success");
  } catch (error) {
    showMessage("Gagal memperbarui data: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// Confirm delete patient
function confirmDeletePatient(index) {
  const patient = patientsData[index];

  if (!patient) {
    alert("Data tidak ditemukan");
    return;
  }

  currentRowToDelete = index + 2; // A2 = row 2

  document.getElementById("patientToDeleteInfo").innerHTML = `
        <strong>No. Registrasi:</strong> ${escapeHtml(patient[0] || "")}<br>
        <strong>Nama:</strong> ${escapeHtml(patient[2] || "")}<br>
        <strong>Tanggal:</strong> ${formatDate(patient[1])}
    `;

  const modal = new bootstrap.Modal(
    document.getElementById("deletePatientModal")
  );
  modal.show();
}

// Delete patient
async function deleteExistingPatient() {
  try {
    showLoading(true);

    await sheetsAPI.deleteRow(currentRowToDelete);

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("deletePatientModal")
    );
    modal.hide();

    // Reload data
    await loadPatientsData();

    currentRowToDelete = null;

    showMessage("Data pasien berhasil dihapus!", "success");
  } catch (error) {
    console.error("Error deleting patient:", error);
    showMessage("Gagal menghapus data: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// Search patient
function searchPatient() {
  const searchTerm = document
    .getElementById("searchInput")
    .value.trim()
    .toLowerCase();

  if (!searchTerm) {
    alert("Masukkan nomor registrasi untuk mencari");
    return;
  }

  const results = patientsData.filter((patient) => {
    const regNumber = (patient[0] || "").toString().toLowerCase();
    return regNumber.includes(searchTerm);
  });

  displaySearchResults(results, searchTerm);
}

// Display search results
function displaySearchResults(results, searchTerm) {
  const container = document.getElementById("searchResults");
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Tidak ditemukan data dengan nomor registrasi "${searchTerm}"
            </div>
        `;
    return;
  }

  let html = `
        <div class="alert alert-success">
            <i class="fas fa-check-circle me-2"></i>
            Ditemukan ${results.length} data dengan nomor registrasi "${searchTerm}"
        </div>
    `;

  results.forEach((patient, index) => {
    const originalIndex = patientsData.indexOf(patient);

    html += `
            <div class="card patient-card mb-3">
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-9">
                            <h5 class="card-title">
                                <i class="fas fa-user-circle me-2 text-primary"></i>
                                ${escapeHtml(
                                  patient[2] || "Nama tidak tersedia"
                                )}
                            </h5>
                            <p class="card-text mb-1"><strong>No. Registrasi:</strong> ${escapeHtml(
                              patient[0] || ""
                            )}</p>
                            <p class="card-text mb-1"><strong>Tanggal:</strong> ${formatDate(
                              patient[1]
                            )}</p>
                            <p class="card-text mb-1"><strong>Wali/Orang Tua:</strong> ${escapeHtml(
                              patient[3] || ""
                            )}</p>
                            <p class="card-text mb-1"><strong>Alamat:</strong> ${escapeHtml(
                              patient[4] || ""
                            )}</p>
                            <p class="card-text mb-1"><strong>Usia:</strong> ${escapeHtml(
                              patient[5] || ""
                            )}</p>
                            <p class="card-text mb-1"><strong>Keluhan:</strong> ${escapeHtml(
                              patient[6] || ""
                            )}</p>
                            <p class="card-text mb-1"><strong>Terapi:</strong> ${escapeHtml(
                              patient[7] || ""
                            )}</p>
                            <p class="card-text mb-0"><strong>Keterangan:</strong> ${escapeHtml(
                              patient[8] || ""
                            )}</p>
                        </div>
                        <div class="col-md-3 text-end">
                            <span class="badge bg-primary">Terdaftar</span>
                            ${
                              checkAuthStatus()
                                ? `
                            <div class="mt-3">
                                <button class="btn btn-sm btn-outline-primary edit-search-btn" data-index="${originalIndex}">
                                    <i class="fas fa-edit me-1"></i> Edit
                                </button>
                            </div>
                            `
                                : ""
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
  });

  container.innerHTML = html;

  // Add event listeners for edit buttons in search results
  document.querySelectorAll(".edit-search-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));

      // Switch to data tab
      const dataTab = document.getElementById("data-tab");
      if (dataTab) {
        const tab = new bootstrap.Tab(dataTab);
        tab.show();
      }

      // Open edit modal
      editPatient(index);
    });
  });
}

// Fungsi untuk membersihkan data usia sebelum disimpan
function cleanAgeInput(ageStr) {
  if (!ageStr) return "";

  const str = ageStr.toString().trim();

  // Jika hanya angka, tambah "tahun"
  if (/^\d+$/.test(str)) {
    const num = parseInt(str);
    return num < 13 ? `${num} bulan` : `${num} tahun`;
  }

  // Standardize format
  return str
    .replace(/thn/gi, "tahun")
    .replace(/bln/gi, "bulan")
    .replace(/\s+/g, " ")
    .trim();
}

// Gunakan di form input
document.getElementById("addAge")?.addEventListener("blur", function () {
  const cleaned = cleanAgeInput(this.value);
  if (cleaned !== this.value) {
    this.value = cleaned;
  }
});

// Helper functions
function validatePatientForm(formType) {
  const prefix = formType === "add" ? "add" : "edit";

  const requiredFields = [
    `${prefix}RegNumber`,
    `${prefix}Date`,
    `${prefix}FullName`,
    `${prefix}Address`,
    `${prefix}Age`,
  ];

  for (const fieldId of requiredFields) {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      field?.focus();
      return false;
    }
  }

  return true;
}

function formatDate(dateString) {
  return formatDateForDisplay(dateString);
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showLoading(show) {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) {
    spinner.style.display = show ? "block" : "none";
  }
}

function displayError(message) {
  const tableBody = document.getElementById("patientTableBody");
  if (tableBody) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-danger py-4">
                    <i class="fas fa-exclamation-triangle fa-2x mb-3 d-block"></i>
                    ${message}
                </td>
            </tr>
        `;
  }
}

// FUNGSI BARU: Show message (sama seperti di auth.js)
function showMessage(message, type = "info") {
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
}

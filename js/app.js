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
      initializeAutocomplete();

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
  <td>${escapeHtml(patient[5] || "")}</td>
  <td>${escapeHtml(patient[6] || "")}</td>
  <td>
    <span class="status-badge ${statusClass}">
      <i class="fas ${statusIcon} me-1"></i>${statusText}
    </span>
  </td>
  <td>
    ${
      isServed
        ? `<div>
            <strong class="text-success">${escapeHtml(
              patient[7] || ""
            )}</strong>
            ${
              patient[8]
                ? `<div class="text-muted small">${escapeHtml(
                    patient[8]
                  ).substring(0, 30)}${
                    patient[8].length > 30 ? "..." : ""
                  }</div>`
                : ""
            }
          </div>`
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
        : isServed && checkAuthStatus()
        ? `
    <button class="btn btn-sm btn-outline-warning service-action-btn edit-therapy-btn" data-index="${index}">
      <i class="fas fa-edit me-1"></i>Edit
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
  document.querySelectorAll(".edit-therapy-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const index = parseInt(this.getAttribute("data-index"));
      editTherapyAndNotes(index);
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
// function markPatientAsServed(index) {
//   const patient = todayPatientsData[index];

//   if (!patient) {
//     alert("Data pasien tidak ditemukan");
//     return;
//   }

//   const therapy = prompt(
//     `Masukkan terapi yang diberikan untuk ${patient[2] || "pasien"}:`,
//     patient[7] || ""
//   );

//   if (therapy === null) return; // User cancelled

//   // Cari index pasien di data utama
//   const mainIndex = patientsData.findIndex(
//     (p) => p[0] === patient[0] && p[1] === patient[1]
//   );

//   if (mainIndex === -1) {
//     alert("Tidak dapat menemukan data pasien di database");
//     return;
//   }

//   // Update data
//   patient[7] = therapy.trim();
//   patientsData[mainIndex][7] = therapy.trim();

//   // Simpan ke Google Sheets
//   updatePatientTherapy(mainIndex, therapy.trim());
// }

// FUNGSI BARU: Update terapi dan keterangan pasien - DIPERBAIKI
async function updatePatientTherapyAndNotes(index, therapy, notes) {
  try {
    showLoading(true);

    const patient = todayPatientsData[index];

    if (!patient) {
      throw new Error("Pasien tidak ditemukan di data hari ini");
    }

    // console.log("🔍 Mencari data asli untuk:", {
    //   noReg: patient[0],
    //   nama: patient[2],
    //   tanggal: patient[1],
    // });

    // CARI INDEX ASLI di patientsData (data utama dari spreadsheet)
    let originalIndex = -1;

    // Coba cari dengan multiple criteria untuk memastikan
    for (let i = 0; i < patientsData.length; i++) {
      const p = patientsData[i];

      // Cek dengan beberapa kriteria untuk memastikan
      const isMatch =
        (p[0] && patient[0] && p[0] === patient[0]) || // No registrasi sama
        (p[2] &&
          patient[2] &&
          p[2] === patient[2] && // Nama sama
          p[1] &&
          patient[1] &&
          p[1] === patient[1]); // Tanggal sama

      if (isMatch) {
        originalIndex = i;
        // console.log(`✅ Ditemukan di index ${i}:`, p);
        break;
      }
    }

    if (originalIndex === -1) {
      console.error("❌ Tidak ditemukan di patientsData:", patient);

      // Fallback: cari dengan lebih longgar
      originalIndex = patientsData.findIndex(
        (p) =>
          (p[2] || "").toString().trim() ===
          (patient[2] || "").toString().trim()
      );

      if (originalIndex === -1) {
        throw new Error(
          `Tidak dapat menemukan pasien "${patient[2]}" di database`
        );
      }
    }

    // Row index untuk spreadsheet (mulai dari 2 karena ada header)
    const spreadsheetRow = originalIndex + 2;

    // console.log(`📝 Update spreadsheet row ${spreadsheetRow} dengan:`, {
    //   therapy: therapy,
    //   notes: notes,
    // });

    // Ambil data asli dari patientsData
    const originalPatient = patientsData[originalIndex];

    // Siapkan data yang diperbarui (PERTAHANKAN data lainnya)
    const updatedPatient = [
      originalPatient[0] || "", // No Registrasi
      originalPatient[1] || "", // Tanggal
      originalPatient[2] || "", // Nama
      originalPatient[3] || "", // Wali
      originalPatient[4] || "", // Alamat
      originalPatient[5] || "", // Usia
      originalPatient[6] || "", // Keluhan
      therapy, // Terapi (diupdate)
      notes, // Keterangan (diupdate)
    ];

    // Simpan ke Google Sheets
    const range = `A${spreadsheetRow}:I${spreadsheetRow}`;
    // console.log(`📍 Range: ${range}`);

    await sheetsAPI.updateData(range, updatedPatient);

    // Update data lokal
    originalPatient[7] = therapy;
    originalPatient[8] = notes;

    // Update todayPatientsData
    patient[7] = therapy;
    patient[8] = notes;

    // Refresh data dari spreadsheet untuk memastikan sinkronisasi
    setTimeout(async () => {
      try {
        await loadPatientsData(); // Reload data dari spreadsheet

        // Refresh tampilan
        loadServiceStatusData();
        updateSummaryLists();

        // showMessage("✅ Data berhasil disimpan ke spreadsheet!", "success");
      } catch (refreshError) {
        console.error("Error saat refresh:", refreshError);
        showMessage("Data lokal diperbarui, tapi refresh gagal", "warning");
      }
    }, 1000);
  } catch (error) {
    console.error("❌ Error updating patient:", error);
    showMessage("Gagal memperbarui data: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// FUNGSI BARU: Tandai pasien sebagai sudah dilayani dengan 2 input
function markPatientAsServed(index) {
  const patient = todayPatientsData[index];

  if (!patient) {
    alert("Data pasien tidak ditemukan");
    return;
  }

  // Buat modal untuk input terapi dan keterangan
  const modalHtml = `
    <div class="modal fade" id="markServedModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-check-circle me-2 text-success"></i>
              Tandai Pasien Selesai
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p><strong>Pasien:</strong> ${escapeHtml(patient[2] || "N/A")}</p>
            <p><strong>No. Registrasi:</strong> ${escapeHtml(
              patient[0] || "N/A"
            )}</p>
            <p><strong>Keluhan:</strong> ${escapeHtml(patient[6] || "N/A")}</p>
            
            <hr>
            
            <div class="mb-3">
              <label for="therapyInput" class="form-label">
                <i class="fas fa-stethoscope me-1"></i> Terapi yang diberikan
                <span class="text-danger">*</span>
              </label>
              <textarea id="therapyInput" class="form-control" rows="2" 
                placeholder="Contoh: Pijat leher, Kompres hangat, dll." 
                required>${escapeHtml(patient[7] || "")}</textarea>
              <div class="form-text">Wajib diisi</div>
            </div>
            
            <div class="mb-3">
              <label for="notesInput" class="form-label">
                <i class="fas fa-clipboard-list me-1"></i> Keterangan Tambahan
              </label>
              <textarea id="notesInput" class="form-control" rows="3" 
                placeholder="Contoh: Kondisi membaik, perlu kontrol ulang, dll.">${escapeHtml(
                  patient[8] || ""
                )}</textarea>
              <div class="form-text">Opsional</div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="button" class="btn btn-success" id="saveMarkServedBtn">
              <i class="fas fa-save me-1"></i> Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Hapus modal lama jika ada
  const oldModal = document.getElementById("markServedModal");
  if (oldModal) oldModal.remove();

  // Tambahkan modal baru
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Tampilkan modal
  const modal = new bootstrap.Modal(document.getElementById("markServedModal"));
  modal.show();

  // Setup event listener untuk tombol simpan
  document.getElementById("saveMarkServedBtn").onclick = function () {
    const therapy = document.getElementById("therapyInput").value.trim();
    const notes = document.getElementById("notesInput").value.trim();

    if (!therapy) {
      alert("Harap isi terapi yang diberikan");
      document.getElementById("therapyInput").focus();
      return;
    }

    // Tutup modal
    modal.hide();

    // Update data
    updatePatientTherapyAndNotes(index, therapy, notes);
  };
}

// // FUNGSI BARU: Update terapi dan keterangan pasien
// async function updatePatientTherapyAndNotes(index, therapy, notes) {
//   try {
//     showLoading(true);

//     const rowIndex = index + 2; // Header row + index
//     const patient = patientsData.find(
//       (p, i) => i === index || p[0] === todayPatientsData[index][0] // Fallback: cari by no. registrasi
//     );

//     if (!patient) {
//       throw new Error("Pasien tidak ditemukan di data utama");
//     }

//     // Siapkan data yang diperbarui
//     const updatedPatient = [
//       patient[0] || "", // No Registrasi
//       patient[1] || "", // Tanggal
//       patient[2] || "", // Nama
//       patient[3] || "", // Wali
//       patient[4] || "", // Alamat
//       patient[5] || "", // Usia
//       patient[6] || "", // Keluhan
//       therapy, // Terapi (diupdate)
//       notes, // Keterangan (diupdate)
//     ];

//     const range = `A${rowIndex}:I${rowIndex}`;
//     console.log(`📝 Update data ke row ${rowIndex}:`, updatedPatient);

//     await sheetsAPI.updateData(range, updatedPatient);

//     // Update data lokal
//     patient[7] = therapy;
//     patient[8] = notes;

//     // Update todayPatientsData
//     if (todayPatientsData[index]) {
//       todayPatientsData[index][7] = therapy;
//       todayPatientsData[index][8] = notes;
//     }

//     // Refresh tampilan
//     loadServiceStatusData(); // Ini akan refresh semua

//     showMessage("Data pasien berhasil diperbarui!", "success");
//   } catch (error) {
//     console.error("❌ Error updating patient:", error);
//     showMessage("Gagal memperbarui data: " + error.message, "error");
//   } finally {
//     showLoading(false);
//   }
// }
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
// function showPatientDetail(index) {
//   const patient = todayPatientsData[index];

//   if (!patient) return;

//   const modalHtml = `
//         <div class="modal fade" id="patientDetailModal" tabindex="-1">
//             <div class="modal-dialog">
//                 <div class="modal-content">
//                     <div class="modal-header">
//                         <h5 class="modal-title">
//                             <i class="fas fa-user-injured me-2"></i>Detail Pasien
//                         </h5>
//                         <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
//                     </div>
//                     <div class="modal-body">
//                         <div class="row">
//                             <div class="col-md-6">
//                                 <p><strong>No. Registrasi:</strong><br>${escapeHtml(
//                                   patient[0] || ""
//                                 )}</p>
//                                 <p><strong>Tanggal:</strong><br>${formatDateForDisplay(
//                                   patient[1]
//                                 )}</p>
//                                 <p><strong>Nama Lengkap:</strong><br>${escapeHtml(
//                                   patient[2] || ""
//                                 )}</p>
//                                 <p><strong>Wali/Orang Tua:</strong><br>${escapeHtml(
//                                   patient[3] || ""
//                                 )}</p>
//                             </div>
//                             <div class="col-md-6">
//                                 <p><strong>Usia:</strong><br>${escapeHtml(
//                                   patient[5] || ""
//                                 )} tahun</p>
//                                 <p><strong>Keluhan:</strong><br>${escapeHtml(
//                                   patient[6] || ""
//                                 )}</p>
//                                 <p><strong>Terapi:</strong><br>
//                                     ${
//                                       patient[7] && patient[7].trim().length > 0
//                                         ? `<span class="text-success">${escapeHtml(
//                                             patient[7]
//                                           )}</span>`
//                                         : '<span class="text-warning fst-italic">Belum dilayani</span>'
//                                     }
//                                 </p>
//                                 <p><strong>Alamat:</strong><br>${escapeHtml(
//                                   patient[4] || ""
//                                 )}</p>
//                             </div>
//                         </div>
//                         ${
//                           patient[8]
//                             ? `<hr><p><strong>Keterangan Tambahan:</strong><br>${escapeHtml(
//                                 patient[8]
//                               )}</p>`
//                             : ""
//                         }
//                     </div>
//                     <div class="modal-footer">
//                         ${
//                           !patient[7] || patient[7].trim().length === 0
//                             ? `
//                         <button type="button" class="btn btn-success" onclick="markPatientAsServed(${index})">
//                             <i class="fas fa-check me-1"></i>Tandai Sudah Dilayani
//                         </button>
//                         `
//                             : ""
//                         }
//                         <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     `;

//   // Hapus modal lama jika ada
//   const oldModal = document.getElementById("patientDetailModal");
//   if (oldModal) oldModal.remove();

//   // Tambahkan modal baru
//   document.body.insertAdjacentHTML("beforeend", modalHtml);

//   // Tampilkan modal
//   const modal = new bootstrap.Modal(
//     document.getElementById("patientDetailModal")
//   );
//   modal.show();
// }

// FUNGSI BARU: Tampilkan detail pasien dengan 2 kolom
function showPatientDetail(index) {
  const patient = todayPatientsData[index];

  if (!patient) return;

  const modalHtml = `
    <div class="modal fade" id="patientDetailModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
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
                <h6 class="border-bottom pb-2 mb-3">
                  <i class="fas fa-info-circle me-1"></i> Data Diri
                </h6>
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
                <p><strong>Usia:</strong><br>${escapeHtml(
                  patient[5] || ""
                )} tahun</p>
              </div>
              <div class="col-md-6">
                <h6 class="border-bottom pb-2 mb-3">
                  <i class="fas fa-clipboard-check me-1"></i> Layanan
                </h6>
                <p><strong>Keluhan:</strong><br>${escapeHtml(
                  patient[6] || ""
                )}</p>
                <p><strong>Terapi:</strong><br>
                  ${
                    patient[7] && patient[7].trim().length > 0
                      ? `<span class="text-success fw-bold">${escapeHtml(
                          patient[7]
                        )}</span>`
                      : '<span class="text-warning fst-italic">Belum dilayani</span>'
                  }
                </p>
                <p><strong>Keterangan:</strong><br>
                  ${
                    patient[8] && patient[8].trim().length > 0
                      ? `${escapeHtml(patient[8])}`
                      : '<span class="text-muted fst-italic">Tidak ada keterangan</span>'
                  }
                </p>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-12">
                <h6 class="border-bottom pb-2 mb-3">
                  <i class="fas fa-map-marker-alt me-1"></i> Alamat
                </h6>
                <p>${escapeHtml(patient[4] || "Tidak ada alamat")}</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            ${
              (!patient[7] || patient[7].trim().length === 0) &&
              checkAuthStatus()
                ? `
            <button type="button" class="btn btn-success" onclick="markPatientAsServed(${index})">
              <i class="fas fa-check me-1"></i>Tandai Sudah Dilayani
            </button>
            `
                : checkAuthStatus()
                ? `
            <button type="button" class="btn btn-warning" onclick="editTherapyAndNotes(${index})">
              <i class="fas fa-edit me-1"></i>Edit Terapi & Keterangan
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

// FUNGSI BARU: Edit terapi dan keterangan (untuk pasien yang sudah dilayani)
function editTherapyAndNotes(index) {
  const patient = todayPatientsData[index];

  if (!patient) {
    alert("Data pasien tidak ditemukan");
    return;
  }

  // Buat modal edit
  const modalHtml = `
    <div class="modal fade" id="editTherapyModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-edit me-2 text-warning"></i>
              Edit Terapi & Keterangan
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p><strong>Pasien:</strong> ${escapeHtml(patient[2] || "N/A")}</p>
            
            <div class="mb-3">
              <label for="editTherapyInput" class="form-label">
                <i class="fas fa-stethoscope me-1"></i> Terapi
              </label>
              <textarea id="editTherapyInput" class="form-control" rows="2">${escapeHtml(
                patient[7] || ""
              )}</textarea>
            </div>
            
            <div class="mb-3">
              <label for="editNotesInput" class="form-label">
                <i class="fas fa-clipboard-list me-1"></i> Keterangan
              </label>
              <textarea id="editNotesInput" class="form-control" rows="3">${escapeHtml(
                patient[8] || ""
              )}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="button" class="btn btn-warning" id="saveEditTherapyBtn">
              <i class="fas fa-save me-1"></i> Update
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Hapus modal lama jika ada
  const oldModal = document.getElementById("editTherapyModal");
  if (oldModal) oldModal.remove();

  // Tambahkan modal baru
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Tampilkan modal
  const modal = new bootstrap.Modal(
    document.getElementById("editTherapyModal")
  );
  modal.show();

  // Tutup modal detail
  const detailModal = bootstrap.Modal.getInstance(
    document.getElementById("patientDetailModal")
  );
  if (detailModal) detailModal.hide();

  // Setup event listener
  document.getElementById("saveEditTherapyBtn").onclick = function () {
    const therapy = document.getElementById("editTherapyInput").value.trim();
    const notes = document.getElementById("editNotesInput").value.trim();

    // Tutup modal edit
    modal.hide();

    // Update data
    updatePatientTherapyAndNotes(index, therapy, notes);
  };
}

// FUNGSI BARU: Update summary lists
// Update summary lists
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
      ${
        patient[8]
          ? `<div class="text-muted small mt-1">${escapeHtml(
              patient[8]
            ).substring(0, 40)}${patient[8].length > 40 ? "..." : ""}</div>`
          : ""
      }
    </div>
    <span class="badge bg-success">${escapeHtml(patient[7] || "").substring(
      0,
      15
    )}${patient[7] && patient[7].length > 15 ? "..." : ""}</span>
  </div>
`;
    });
    servedList.innerHTML = servedHtml;
  } else {
    servedList.innerHTML =
      '<p class="text-muted">Belum ada pasien yang dilayani</p>';
  }

  // Update not served patients list - DIPERBAIKI
  const notServedList = document.getElementById("notServedPatientsList");
  if (notServedPatients.length > 0) {
    let notServedHtml = "";

    notServedPatients.forEach((patient) => {
      const usia = patient[5] ? `${escapeHtml(patient[5])}` : "-";

      // CARI INDEX ASLI di todayPatientsData
      const originalIndex = todayPatientsData.findIndex(
        (p) =>
          p[0] === patient[0] && // No registrasi sama
          p[1] === patient[1] // Tanggal sama
      );

      notServedHtml += `
        <div class="patient-list-item">
          <div>
            <strong>${escapeHtml(patient[2] || "")}</strong>
            <div class="text-muted small">${escapeHtml(
              patient[0] || ""
            )} • ${usia}</div>
          </div>
          <button class="btn btn-sm btn-outline-success mark-from-list-btn" 
                  data-index="${originalIndex}">
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
        if (index >= 0) {
          markPatientAsServed(index);
        } else {
          alert("Gagal menemukan data pasien");
        }
      });
    });
  } else {
    notServedList.innerHTML =
      '<p class="text-success">Semua pasien sudah dilayani! 🎉</p>';
  }
}
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
  // const addModal = document.getElementById("addPatientModal");
  // if (addModal) {
  //   addModal.addEventListener("hidden.bs.modal", function () {
  //     document.getElementById("addPatientForm").reset();
  //     document.getElementById("addDate").value = new Date()
  //       .toISOString()
  //       .split("T")[0];
  //   });
  // }
  // Modal close events
  // Modal close events
  const addModal = document.getElementById("addPatientModal");
  if (addModal) {
    addModal.addEventListener("hidden.bs.modal", function () {
      resetAddPatientForm();
    });

    // Initialize autocomplete ketika modal dibuka
    addModal.addEventListener("shown.bs.modal", function () {
      console.log("📋 Add patient modal opened");

      // Pastikan patientsData sudah terload
      if (!patientsData || patientsData.length === 0) {
        console.warn("⚠️ patientsData belum terload, loading now...");
        loadPatientsData().then(() => {
          setupPatientAutocomplete();
        });
      } else {
        setupPatientAutocomplete();
      }

      // Generate nomor registrasi baru setiap kali modal dibuka
      const newRegNumber = generateRegistrationNumber();
      document.getElementById("addRegNumber").value = newRegNumber;
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
  // const today = new Date().toISOString().split("T")[0];
  // console.log("🔍 Performing global search...", filterToday);

  let filteredData = patientsData;

  // Filter by date if needed
  // Filter by date if needed - DIPERBAIKI
  if (filterToday) {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // console.log(
    //   `📅 Filter: Mencari pasien tanggal ${todayDay}/${todayMonth}/${todayYear}`
    // );

    filteredData = patientsData.filter((patient) => {
      const patientDateStr = patient[1] ? patient[1].toString().trim() : "";

      if (!patientDateStr) {
        // console.log(
        //   `  ❌ Data ${patient[0]} - ${patient[2]}: tidak ada tanggal`
        // );
        return false;
      }

      // console.log(`  ⏳ Cek: "${patientDateStr}" untuk ${patient[2]}`);

      // Parse tanggal dari berbagai format
      let patientDay, patientMonth, patientYear;

      // Format: DD/MM/YY (01/01/26)
      if (patientDateStr.includes("/")) {
        const parts = patientDateStr.split("/");
        if (parts.length === 3) {
          patientDay = parseInt(parts[0]);
          patientMonth = parseInt(parts[1]);
          let year = parseInt(parts[2]);

          // Convert 2-digit year to 4-digit
          if (year < 100) {
            year += 2000;
          }
          patientYear = year;
        }
      }
      // Format: YYYY-MM-DD (2026-01-01)
      else if (patientDateStr.includes("-")) {
        const datePart = patientDateStr.split("T")[0];
        const parts = datePart.split("-");
        if (parts.length === 3) {
          patientYear = parseInt(parts[0]);
          patientMonth = parseInt(parts[1]);
          patientDay = parseInt(parts[2]);
        }
      }

      // Bandingkan dengan hari ini
      if (patientDay && patientMonth && patientYear) {
        const isMatch =
          patientDay === todayDay &&
          patientMonth === todayMonth &&
          patientYear === todayYear;

        // if (isMatch) {
        //   console.log(
        //     `    ✅ COCOK! ${patientDay}/${patientMonth}/${patientYear}`
        //   );
        // } else {
        //   console.log(
        //     `    ❌ TIDAK COCOK: ${patientDay}/${patientMonth}/${patientYear}`
        //   );
        // }

        return isMatch;
      }

      // console.log(`    ❌ GAGAL PARSE: "${patientDateStr}"`);
      return false;
    });

    // console.log(`🎯 Hasil filter: ${filteredData.length} pasien ditemukan`);
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
// async function saveNewPatient() {
//   try {
//     if (!validatePatientForm("add")) {
//       showMessage("Harap isi semua kolom wajib", "warning");
//       return;
//     }

//     // CEK TOKEN sebelum operasi
//     if (!(await auth.checkTokenBeforeOperation())) {
//       return; // Akan dihandle oleh auth module
//     }

//     const patientData = [
//       document.getElementById("addRegNumber").value.trim(),
//       document.getElementById("addDate").value, // Format: YYYY-MM-DD
//       document.getElementById("addFullName").value.trim(),
//       document.getElementById("addParent").value.trim(),
//       document.getElementById("addAddress").value.trim(),
//       document.getElementById("addAge").value,
//       document.getElementById("addComplaint").value.trim(),
//       document.getElementById("addTherapy").value.trim(),
//       document.getElementById("addNotes").value.trim(),
//     ];

//     // console.log("➕ Menambahkan data baru:", patientData);

//     showLoading(true);

//     await sheetsAPI.appendData(patientData);

//     // Tutup modal
//     const modal = bootstrap.Modal.getInstance(
//       document.getElementById("addPatientModal")
//     );
//     modal.hide();

//     // Reset form
//     document.getElementById("addPatientForm").reset();
//     document.getElementById("addDate").value = new Date()
//       .toISOString()
//       .split("T")[0];

//     // console.log("🔄 Memuat ulang data...");

//     // MUAT ULANG DATA DENGAN CARA YANG BENAR
//     await loadPatientsData(); // Ini akan refresh semua data

//     // TUNGGU SEBENTAR lalu refresh tab layanan
//     setTimeout(() => {
//       const activeTab = document.querySelector(".nav-tabs .nav-link.active");
//       // console.log("📍 Tab aktif:", activeTab?.id);

//       if (
//         activeTab &&
//         (activeTab.id === "layanan-tab" || activeTab.id === "data-tab")
//       ) {
//         // console.log("🔄 Refresh tab aktif");
//         if (activeTab.id === "layanan-tab") {
//           loadServiceStatusData();
//         }
//         // Tab data-tab sudah di-refresh oleh loadPatientsData()
//       }
//     }, 1000);

//     showMessage("Data pasien berhasil ditambahkan!", "success");
//   } catch (error) {
//     if (error.message.includes("Token expired")) {
//       // Sudah dihandle oleh auth module
//       return;
//     }
//     console.error("❌ Error adding patient:", error);
//     showMessage("Gagal menambah data: " + error.message, "error");
//   } finally {
//     showLoading(false);
//   }
// }
// Save new patient dengan support untuk pasien lama
async function saveNewPatient() {
  try {
    if (!validatePatientForm("add")) {
      showMessage("Harap isi semua kolom wajib", "warning");
      return;
    }

    // CEK TOKEN sebelum operasi
    if (!(await auth.checkTokenBeforeOperation())) {
      return;
    }

    const isExisting =
      document.getElementById("isExistingPatient").value === "true";

    let patientData;

    if (isExisting) {
      // Ambil data pasien lama untuk di-copy
      try {
        const selectedData = JSON.parse(
          document.getElementById("selectedPatientData").value
        );
        patientData = [
          document.getElementById("addRegNumber").value.trim(),
          document.getElementById("addDate").value,
          document.getElementById("addFullName").value.trim(),
          document.getElementById("addParent").value.trim(),
          document.getElementById("addAddress").value.trim(),
          document.getElementById("addAge").value,
          document.getElementById("addComplaint").value.trim(), // Keluhan baru
          document.getElementById("addTherapy").value.trim(), // Terapi baru
          document.getElementById("addNotes").value.trim(), // Keterangan baru
        ];

        console.log(
          "Menyimpan kunjungan baru untuk pasien lama:",
          selectedData[2]
        );
      } catch (e) {
        console.error("Error menggunakan data pasien lama:", e);
        // Fallback ke data biasa
        patientData = getPatientDataFromForm();
      }
    } else {
      // Pasien baru
      patientData = getPatientDataFromForm();
    }

    // console.log("➕ Menambahkan data baru:", patientData);

    showLoading(true);

    await sheetsAPI.appendData(patientData);

    // Tutup modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("addPatientModal")
    );
    modal.hide();

    // Reset form
    resetAddPatientForm();

    // console.log("🔄 Memuat ulang data...");

    // Refresh data
    await loadPatientsData();

    showMessage("Data pasien berhasil ditambahkan!", "success");
  } catch (error) {
    if (error.message.includes("Token expired")) {
      return;
    }
    console.error("❌ Error adding patient:", error);
    showMessage("Gagal menambah data: " + error.message, "error");
  } finally {
    showLoading(false);
  }
}

// FUNGSI BARU: Get patient data from form
function getPatientDataFromForm() {
  return [
    document.getElementById("addRegNumber").value.trim(),
    document.getElementById("addDate").value,
    document.getElementById("addFullName").value.trim(),
    document.getElementById("addParent").value.trim(),
    document.getElementById("addAddress").value.trim(),
    document.getElementById("addAge").value,
    document.getElementById("addComplaint").value.trim(),
    document.getElementById("addTherapy").value.trim(),
    document.getElementById("addNotes").value.trim(),
  ];
}

// FUNGSI BARU: Reset add patient form
function resetAddPatientForm() {
  document.getElementById("addPatientForm").reset();
  document.getElementById("addDate").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("isExistingPatient").value = "false";
  document.getElementById("selectedPatientData").value = "";

  // Generate nomor registrasi baru
  const newRegNumber = generateRegistrationNumber();
  document.getElementById("addRegNumber").value = newRegNumber;
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

  const messageDiv = document?.createElement("div");
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

// FUNGSI BARU: Setup autocomplete untuk nama pasien
// function setupPatientAutocomplete() {
//   const nameInput = document.getElementById("addFullName");
//   const suggestionsList = document.getElementById("patientSuggestions");

//   if (!nameInput || !suggestionsList) return;

//   // Event listener untuk input
//   nameInput.addEventListener("input", function () {
//     const searchTerm = this.value.trim();

//     if (searchTerm.length < 2) {
//       suggestionsList.innerHTML = "";
//       return;
//     }

//     // Filter pasien berdasarkan nama
//     const suggestions = getPatientSuggestions(searchTerm);

//     // Update datalist
//     suggestionsList.innerHTML = "";
//     suggestions.forEach((suggestion) => {
//       const option = document.createElement("option");
//       option.value = suggestion.displayText;
//       option.setAttribute(
//         "data-patient",
//         JSON.stringify(suggestion.patientData)
//       );
//       suggestionsList.appendChild(option);
//     });
//   });

//   // Event listener untuk pilih dari dropdown
//   nameInput.addEventListener("change", function () {
//     const selectedOption = Array.from(suggestionsList.options).find(
//       (option) => option.value === this.value
//     );

//     if (selectedOption && selectedOption.getAttribute("data-patient")) {
//       try {
//         const patientData = JSON.parse(
//           selectedOption.getAttribute("data-patient")
//         );
//         autoFillPatientForm(patientData);
//       } catch (e) {
//         console.error("Error parsing patient data:", e);
//       }
//     }
//   });

//   // Event listener untuk keyup (mendeteksi pilihan)
//   nameInput.addEventListener("keyup", function (e) {
//     // Jika user mengetik manual, reset form
//     if (e.key.length === 1 && this.value.length > 0) {
//       document.getElementById("isExistingPatient").value = "false";
//     }
//   });
// }

// FUNGSI BARU: Setup autocomplete untuk nama pasien - DIPERBAIKI
function setupPatientAutocomplete() {
  const nameInput = document.getElementById("addFullName");
  const suggestionsList = document.getElementById("patientSuggestions");

  if (!nameInput || !suggestionsList) {
    console.error("❌ Element untuk autocomplete tidak ditemukan");
    return;
  }

  // console.log("🔧 Setting up autocomplete for patient name input");

  // Clear previous event listeners (jika ada)
  nameInput.removeEventListener("input", handleNameInput);
  nameInput.removeEventListener("change", handleNameChange);

  // Add new event listeners
  nameInput.addEventListener("input", handleNameInput);
  nameInput.addEventListener("change", handleNameChange);

  // Event listener untuk keyup (mendeteksi pilihan)
  nameInput.addEventListener("keyup", function (e) {
    // Jika user mengetik manual, reset form
    if (e.key.length === 1 && this.value.length > 0) {
      document.getElementById("isExistingPatient").value = "false";
    }
  });
}

// Handler untuk input event
function handleNameInput(event) {
  const searchTerm = event.target.value.trim();
  const suggestionsList = document.getElementById("patientSuggestions");

  if (!suggestionsList) return;

  if (searchTerm.length < 2) {
    suggestionsList.innerHTML = "";
    return;
  }

  // Filter pasien berdasarkan nama
  const suggestions = getPatientSuggestions(searchTerm);

  // Update datalist
  suggestionsList.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const option = document.createElement("option");
    option.value = suggestion.displayText;
    option.setAttribute("data-patient", JSON.stringify(suggestion.patientData));
    suggestionsList.appendChild(option);
  });
}

// Handler untuk change event
function handleNameChange(event) {
  const suggestionsList = document.getElementById("patientSuggestions");
  if (!suggestionsList) return;

  const selectedOption = Array.from(suggestionsList.options).find(
    (option) => option.value === event.target.value
  );

  if (selectedOption && selectedOption.getAttribute("data-patient")) {
    try {
      const patientData = JSON.parse(
        selectedOption.getAttribute("data-patient")
      );
      autoFillPatientForm(patientData);
    } catch (e) {
      console.error("Error parsing patient data:", e);
    }
  }
}

// FUNGSI BARU: Get patient suggestions - DIPERBAIKI
function getPatientSuggestions(searchTerm) {
  // NULL CHECK pertama
  if (!patientsData || !Array.isArray(patientsData)) {
    console.warn("⚠️ patientsData tidak tersedia atau bukan array");
    return [];
  }

  if (patientsData.length === 0) {
    // console.log("ℹ️ patientsData kosong");
    return [];
  }

  const searchLower = searchTerm.toLowerCase();

  // Filter dan ambil data unik berdasarkan nama
  const uniquePatients = new Map();

  patientsData.forEach((patient, index) => {
    // NULL CHECK untuk setiap patient
    if (!patient || !Array.isArray(patient)) {
      console.warn(`⚠️ Patient data di index ${index} tidak valid:`, patient);
      return;
    }

    const name = patient[2] || "";
    if (name.toLowerCase().includes(searchLower)) {
      if (!uniquePatients.has(name)) {
        uniquePatients.set(name, patient);
      }
    }
  });

  // Convert ke array dengan format yang lebih baik
  const suggestions = Array.from(uniquePatients.entries()).map(
    ([name, patientData]) => {
      const usia = patientData[5] ? `, ${patientData[5]}` : "";
      const alamat = patientData[4]
        ? ` - ${patientData[4].substring(0, 30)}${
            patientData[4].length > 30 ? "..." : ""
          }`
        : "";

      return {
        displayText: `${name}${usia}${alamat}`,
        patientData: patientData,
      };
    }
  );

  // console.log(`🔍 Found ${suggestions.length} suggestions for "${searchTerm}"`);

  // Batasi maksimal 10 saran
  return suggestions.slice(0, 10);
}

// FUNGSI BARU: Auto-fill form dengan data pasien lama
function autoFillPatientForm(patientData) {
  // NULL CHECK
  if (!patientData || !Array.isArray(patientData)) {
    console.error("❌ Patient data tidak valid:", patientData);
    showMessage("Data pasien tidak valid", "error");
    return;
  }

  // console.log("✅ Auto-fill form dengan data:", patientData);

  // Cek apakah pasien memiliki riwayat sebelumnya
  const hasHistory = checkPatientHistory(patientData);

  if (hasHistory) {
    // Tampilkan modal konfirmasi riwayat
    showPatientHistoryModal(patientData);
  } else {
    // Langsung isi form tanpa modal (pasien baru atau tidak ada riwayat)
    fillFormDirectly(patientData);
  }
}

// FUNGSI BARU: Cek apakah pasien punya riwayat
function checkPatientHistory(patientData) {
  if (!patientsData || patientsData.length === 0) return false;

  const patientName = patientData[2] || "";
  const patientAddress = patientData[4] || "";

  // Cari pasien dengan nama dan alamat yang sama
  const matchingPatients = patientsData.filter((p) => {
    const nameMatch = (p[2] || "").toLowerCase() === patientName.toLowerCase();
    const addressMatch =
      (p[4] || "").toLowerCase() === patientAddress.toLowerCase();

    return nameMatch && addressMatch;
  });

  // Return true jika ditemukan lebih dari 1 (artinya ada riwayat)
  return matchingPatients.length > 0;
}

// FUNGSI BARU: Isi form langsung tanpa modal
function fillFormDirectly(patientData) {
  // console.log("📝 Mengisi form langsung");

  // Tandai sebagai pasien lama
  document.getElementById("isExistingPatient").value = "true";
  document.getElementById("selectedPatientData").value =
    JSON.stringify(patientData);

  // Isi form dengan data pasien lama
  document.getElementById("addFullName").value = patientData[2] || "";
  document.getElementById("addParent").value = patientData[3] || "";
  document.getElementById("addAddress").value = patientData[4] || "";
  document.getElementById("addAge").value = patientData[5] || "";

  // Kosongkan field yang spesifik untuk kunjungan baru
  document.getElementById("addComplaint").value = "";
  document.getElementById("addTherapy").value = "";
  document.getElementById("addNotes").value = "";

  // Cari nomor registrasi terakhir untuk pasien ini
  const lastRegNumber = findLastRegistrationNumber(patientData);

  if (lastRegNumber) {
    // Tampilkan nomor registrasi terakhir
    document.getElementById("addRegNumber").value = lastRegNumber;
    // console.log(`📋 Menggunakan nomor registrasi terakhir: ${lastRegNumber}`);
  } else {
    // Generate nomor registrasi baru
    const newRegNumber = generateRegistrationNumber();
    document.getElementById("addRegNumber").value = newRegNumber;
    // console.log(
    //   `📋 Tidak ada nomor registrasi lama, generate baru: ${newRegNumber}`
    // );
  }

  // Set tanggal hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("addDate").value = today;

  // Tampilkan notifikasi
  if (lastRegNumber) {
    showMessage(
      `Data pasien lama dimuat. Nomor registrasi terakhir: ${lastRegNumber}`,
      "info"
    );
  } else {
    showMessage(
      "Data pasien lama dimuat. Isi keluhan dan terapi untuk kunjungan baru.",
      "info"
    );
  }
}

// FUNGSI BARU: Cari nomor registrasi terakhir untuk pasien tertentu
function findLastRegistrationNumber(patientData) {
  if (!patientsData || patientsData.length === 0) return null;

  const patientName = patientData[2] || "";
  const patientAddress = patientData[4] || "";

  // Filter pasien dengan nama dan alamat yang sama
  const patientHistory = patientsData.filter((p) => {
    const nameMatch = (p[2] || "").toLowerCase() === patientName.toLowerCase();
    const addressMatch =
      (p[4] || "").toLowerCase() === patientAddress.toLowerCase();

    // Bisa juga tambahkan kriteria lain jika perlu
    return nameMatch && addressMatch;
  });

  if (patientHistory.length === 0) return null;

  // Urutkan berdasarkan tanggal (terbaru dulu)
  patientHistory.sort((a, b) => {
    const dateA = parseDateString(a[1]);
    const dateB = parseDateString(b[1]);
    return dateB - dateA; // Descending
  });

  // Ambil nomor registrasi dari kunjungan terakhir
  const lastRegNumber = patientHistory[0][0] || null;

  // console.log(`📊 Riwayat pasien ${patientName}:`, {
  //   totalKunjungan: patientHistory.length,
  //   terakhir: patientHistory[0][1],
  //   nomorRegistrasiTerakhir: lastRegNumber,
  // });

  return lastRegNumber;
}

// FUNGSI BARU: Parse tanggal dari string
function parseDateString(dateStr) {
  if (!dateStr) return new Date(0);

  try {
    // Format DD/MM/YY atau DD/MM/YYYY
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        let day = parseInt(parts[0]);
        let month = parseInt(parts[1]) - 1;
        let year = parseInt(parts[2]);

        if (year < 100) year += 2000;

        return new Date(year, month, day);
      }
    }

    // Format YYYY-MM-DD
    if (dateStr.includes("-")) {
      return new Date(dateStr);
    }

    // Default parse
    return new Date(dateStr);
  } catch (e) {
    console.error("Error parsing date:", dateStr, e);
    return new Date(0);
  }
}

// FUNGSI BARU: Cari pasien berdasarkan nama
// FUNGSI BARU: Cari pasien berdasarkan nama
function findPatientByName(name) {
  if (!patientsData || patientsData.length === 0) return null;

  const nameLower = name.toLowerCase();

  // Cari exact match dulu
  for (let patient of patientsData) {
    if (!patient || !Array.isArray(patient)) continue;

    const patientName = (patient[2] || "").toLowerCase();
    if (patientName === nameLower) {
      return patient;
    }
  }

  // Jika tidak ditemukan exact match, cari partial match
  for (let patient of patientsData) {
    if (!patient || !Array.isArray(patient)) continue;

    const patientName = (patient[2] || "").toLowerCase();
    if (patientName.includes(nameLower) || nameLower.includes(patientName)) {
      return patient;
    }
  }

  return null;
}

// FUNGSI BARU: Tampilkan modal konfirmasi untuk pasien lama
// FUNGSI BARU: Tampilkan modal riwayat pasien - DIPERBAIKI
function showPatientHistoryModal(patientData) {
  // console.log("📊 Menampilkan modal riwayat untuk:", patientData[2]);

  // Cari nomor registrasi terakhir
  const lastRegNumber = findLastRegistrationNumber(patientData);

  const modalHtml = `
    <div class="modal fade" id="patientHistoryModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-history me-2"></i>
              Pasien Terdaftar
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p><strong>${escapeHtml(
              patientData[2] || ""
            )}</strong> sudah terdaftar sebelumnya.</p>
            <p><strong>Nomor Registrasi Terakhir:</strong> ${escapeHtml(
              lastRegNumber || "Tidak ada"
            )}</p>
            <p><strong>Usia:</strong> ${escapeHtml(patientData[5] || "")}</p>
            <p><strong>Alamat:</strong> ${escapeHtml(patientData[4] || "")}</p>
            
            <div class="alert alert-info mt-3">
              <i class="fas fa-info-circle me-2"></i>
              Pilih opsi di bawah untuk melanjutkan.
            </div>
            
            <div class="form-check mt-3">
              <input class="form-check-input" type="checkbox" id="useLastRegNumber" ${
                lastRegNumber ? "checked" : "disabled"
              }>
              <label class="form-check-label" for="useLastRegNumber">
                Gunakan nomor registrasi terakhir
                ${
                  !lastRegNumber
                    ? '<span class="text-muted"> (Tidak tersedia)</span>'
                    : ""
                }
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-1"></i>Batal
            </button>
            <button type="button" class="btn btn-secondary" id="createNewBtn">
              <i class="fas fa-plus me-1"></i>Buat Baru
            </button>
            <button type="button" class="btn btn-primary" id="useExistingBtn">
              <i class="fas fa-check me-1"></i>Gunakan Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Hapus modal lama jika ada
  const oldModal = document.getElementById("patientHistoryModal");
  if (oldModal) oldModal.remove();

  // Tambahkan modal baru
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Tampilkan modal
  const modalElement = document.getElementById("patientHistoryModal");
  const modal = new bootstrap.Modal(modalElement);
  modal.show();

  // Setup event listeners - HARUS SETELAH modal ditambahkan ke DOM
  modalElement.addEventListener("shown.bs.modal", function () {
    // console.log("Modal riwayat ditampilkan");

    // Tombol "Gunakan Data"
    document.getElementById("useExistingBtn").onclick = function () {
      const useLastReg = document.getElementById("useLastRegNumber").checked;

      if (useLastReg && lastRegNumber) {
        // Gunakan nomor registrasi lama
        // console.log("Menggunakan nomor registrasi lama:", lastRegNumber);
        fillFormWithLastReg(patientData, lastRegNumber);
      } else {
        // Gunakan data lama tapi generate nomor baru
        // console.log("Menggunakan data lama dengan nomor baru");
        fillFormWithNewReg(patientData);
      }

      modal.hide();
      removeModalFromDOM();
    };

    // Tombol "Buat Baru"
    document.getElementById("createNewBtn").onclick = function () {
      // console.log("Membuat data baru untuk pasien yang sama");
      fillFormWithNewReg(patientData);
      modal.hide();
      removeModalFromDOM();
    };

    // Tombol "Batal" (X atau tombol batal)
    modalElement
      .querySelector('[data-bs-dismiss="modal"]')
      .addEventListener("click", function () {
        // console.log("Modal dibatalkan");
        removeModalFromDOM();
      });
  });
}

// FUNGSI BARU: Hapus modal dari DOM setelah ditutup
function removeModalFromDOM() {
  setTimeout(() => {
    const modal = document.getElementById("patientHistoryModal");
    if (modal) {
      modal.remove();
      // console.log("Modal dihapus dari DOM");
    }
  }, 500);
}

// FUNGSI BARU: Isi form dengan nomor registrasi lama
function fillFormWithLastReg(patientData, lastRegNumber) {
  // Tandai sebagai pasien lama
  document.getElementById("isExistingPatient").value = "true";
  document.getElementById("selectedPatientData").value =
    JSON.stringify(patientData);

  // Isi form
  document.getElementById("addFullName").value = patientData[2] || "";
  document.getElementById("addParent").value = patientData[3] || "";
  document.getElementById("addAddress").value = patientData[4] || "";
  document.getElementById("addAge").value = patientData[5] || "";
  document.getElementById("addRegNumber").value = lastRegNumber;

  // Kosongkan field kunjungan baru
  document.getElementById("addComplaint").value = "";
  document.getElementById("addTherapy").value = "";
  document.getElementById("addNotes").value = "";

  // Set tanggal hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("addDate").value = today;

  showMessage(`Menggunakan nomor registrasi lama: ${lastRegNumber}`, "info");
}

// FUNGSI BARU: Isi form dengan nomor registrasi baru
function fillFormWithNewReg(patientData) {
  const newRegNumber = generateRegistrationNumber();

  // Tandai sebagai pasien lama
  document.getElementById("isExistingPatient").value = "true";
  document.getElementById("selectedPatientData").value =
    JSON.stringify(patientData);

  // Isi form
  document.getElementById("addFullName").value = patientData[2] || "";
  document.getElementById("addParent").value = patientData[3] || "";
  document.getElementById("addAddress").value = patientData[4] || "";
  document.getElementById("addAge").value = patientData[5] || "";
  document.getElementById("addRegNumber").value = newRegNumber;

  // Kosongkan field kunjungan baru
  document.getElementById("addComplaint").value = "";
  document.getElementById("addTherapy").value = "";
  document.getElementById("addNotes").value = "";

  // Set tanggal hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("addDate").value = today;

  showMessage(`Nomor registrasi baru: ${newRegNumber}`, "info");
}

// FUNGSI BARU: Generate nomor registrasi baru
function generateRegistrationNumber() {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  // Cari nomor urut tertinggi untuk hari ini
  let highestNumber = 0;

  if (patientsData && patientsData.length > 0) {
    patientsData.forEach((patient) => {
      const regNum = patient[0] || "";

      // Pattern: REGYYMMDDXXX
      const pattern = new RegExp(`^REG${year}${month}${day}(\\d{3})$`);
      const match = regNum.match(pattern);

      if (match) {
        const num = parseInt(match[1]);
        if (num > highestNumber) {
          highestNumber = num;
        }
      }
    });
  }

  const nextNumber = highestNumber + 1;
  return `REG${year}${month}${day}${String(nextNumber).padStart(3, "0")}`;
}

// FUNGSI BARU: Initialize autocomplete setelah data terload
function initializeAutocomplete() {
  // console.log("🔄 Initializing autocomplete...");
  // console.log("patientsData length:", patientsData ? patientsData.length : 0);

  if (!patientsData || patientsData.length === 0) {
    console.warn(
      "⚠️ patientsData masih kosong, autocomplete tidak bisa diinisialisasi"
    );
    return;
  }

  setupPatientAutocomplete();

  // Juga setup untuk edit form jika diperlukan
  // setupEditFormAutocomplete();
}

// Event listener untuk validasi manual input nama (blur event)
document.getElementById("addFullName")?.addEventListener("blur", function () {
  const name = this.value.trim();

  if (
    name.length >= 2 &&
    document.getElementById("isExistingPatient").value === "false"
  ) {
    // Cari apakah nama ini sudah ada di database
    const existingPatient = findPatientByName(name);

    if (existingPatient) {
      // Tampilkan modal konfirmasi
      showPatientHistoryModal(existingPatient);
    }
  }
});

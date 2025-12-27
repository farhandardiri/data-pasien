const ageParser = {
  // Parse berbagai format usia
  parseAge(ageStr) {
    if (!ageStr || ageStr.toString().trim() === "") {
      return { years: 0, months: 0, isValid: false };
    }

    const str = ageStr.toString().toLowerCase().trim();

    // 1. Format: "32 tahun" atau "32 th"
    const tahunMatch = str.match(/(\d+)\s*(tahun|thn|th|t)/);
    if (tahunMatch) {
      return {
        years: parseInt(tahunMatch[1]),
        months: 0,
        isValid: true,
        raw: str,
      };
    }

    // 2. Format: "10 bulan" atau "10 bln" atau "10 bl"
    const bulanMatch = str.match(/(\d+)\s*(bulan|bln|bl|b)/);
    if (bulanMatch) {
      const months = parseInt(bulanMatch[1]);
      return {
        years: Math.floor(months / 12),
        months: months % 12,
        isValid: true,
        raw: str,
      };
    }

    // 3. Format: "9 tahun 6 bulan" atau "9 th 6 bl"
    const kombinasiMatch = str.match(
      /(\d+)\s*(tahun|thn|th|t).*?(\d+)\s*(bulan|bln|bl|b)/
    );
    if (kombinasiMatch) {
      return {
        years: parseInt(kombinasiMatch[1]),
        months: parseInt(kombinasiMatch[3]),
        isValid: true,
        raw: str,
      };
    }

    // 4. Format: Angka saja - asumsi tahun
    const angkaSajaMatch = str.match(/^(\d+)$/);
    if (angkaSajaMatch) {
      const num = parseInt(angkaSajaMatch[1]);

      // Jika angka < 13, kemungkinan bulan, tapi kita asumsi tahun
      // Atau bisa logika: jika < 3 = tahun, jika 3-12 = ambiguous
      return {
        years: num,
        months: 0,
        isValid: true,
        raw: str,
        note: num < 13 ? "mungkin-bulan" : "asumsi-tahun",
      };
    }

    return { years: 0, months: 0, isValid: false, raw: str };
  },

  // Konversi ke total bulan untuk perhitungan
  toMonths(ageStr) {
    const parsed = this.parseAge(ageStr);
    return parsed.years * 12 + parsed.months;
  },

  // Format untuk display
  formatAge(ageStr) {
    const parsed = this.parseAge(ageStr);

    if (!parsed.isValid) {
      return "Usia tidak valid";
    }

    if (parsed.years > 0 && parsed.months > 0) {
      return `${parsed.years} tahun ${parsed.months} bulan`;
    } else if (parsed.years > 0) {
      return `${parsed.years} tahun`;
    } else if (parsed.months > 0) {
      return `${parsed.months} bulan`;
    } else {
      return "0 tahun";
    }
  },

  // Kategori usia untuk dashboard
  categorizeAge(ageStr) {
    const months = this.toMonths(ageStr);

    if (months === 0) return "unknown";

    // Kategori berdasarkan bulan
    if (months <= 12) return "bayi"; // 0-12 bulan
    if (months <= 60) return "balita"; // 1-5 tahun
    if (months <= 144) return "anak"; // 6-12 tahun
    if (months <= 228) return "remaja"; // 13-19 tahun
    if (months <= 420) return "dewasa-muda"; // 20-35 tahun
    if (months <= 660) return "dewasa-tengah"; // 36-55 tahun
    return "lansia"; // 55+ tahun
  },

  // Kategori untuk statistik umum (lebih sederhana)
  categorizeSimple(ageStr) {
    const parsed = this.parseAge(ageStr);
    const years = parsed.years;

    if (!parsed.isValid) return "tidak-diketahui";

    if (years < 1) return "bayi"; // < 1 tahun
    if (years <= 5) return "balita"; // 1-5 tahun
    if (years <= 12) return "anak"; // 6-12 tahun
    if (years <= 19) return "remaja"; // 13-19 tahun
    if (years <= 35) return "dewasa-muda"; // 20-35 tahun
    if (years <= 55) return "dewasa"; // 36-55 tahun
    return "lansia"; // 55+ tahun
  },
};

// File: js/dashboard.js
const dashboard = {
  // Initialize dashboard
  init() {
    // console.log("Dashboard initialized");
    this.setupEventListeners();
    this.loadDashboardData();
  },

  // Setup event listeners
  setupEventListeners() {
    // Period buttons
    document.querySelectorAll("[data-period]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const period = e.target.getAttribute("data-period");
        this.switchPeriod(period);

        // Nonaktifkan custom month selection
        document.getElementById("customMonth").value = "";
      });
    });

    // Custom month selector - INI YANG PENTING!
    const monthInput = document.getElementById("customMonth");
    if (monthInput) {
      monthInput.addEventListener("change", (e) => {
        const yearMonth = e.target.value; // Format: "2025-12"

        if (yearMonth) {
          // Nonaktifkan semua period buttons
          document.querySelectorAll("[data-period]").forEach((btn) => {
            btn.classList.remove("active");
          });

          // Load data untuk bulan yang dipilih
          this.loadCustomMonthData(yearMonth);
        }
      });

      // Juga trigger pada bulan berjalan saat pertama kali
      monthInput.value = new Date().toISOString().slice(0, 7);
    }

    // Tab shown event
    document
      .getElementById("dashboard-tab")
      ?.addEventListener("shown.bs.tab", () => {
        this.loadDashboardData();
      });
  },

  // Switch period
  // Switch period
  switchPeriod(period) {
    // Update active button
    document.querySelectorAll("[data-period]").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-period="${period}"]`).classList.add("active");

    // Reset custom month input
    const monthInput = document.getElementById("customMonth");
    if (monthInput) {
      monthInput.value = "";
    }

    // Update dashboard header
    const header = document.querySelector(".dashboard-header h4");
    if (header) {
      const periodNames = {
        today: "Hari Ini",
        week: "Minggu Ini",
        month: "Bulan Ini",
        year: "Tahun Ini",
      };
      header.innerHTML = `<i class="fas fa-tachometer-alt me-2"></i>Dashboard - ${periodNames[period]}`;
    }

    // Load data for period
    this.loadDashboardData(period);
  },

  // Load dashboard data
  async loadDashboardData(period = "today") {
    try {
      // Show loading
      document.getElementById("dashboardContent").innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Memuat data dashboard...</p>
                </div>
            `;

      // Get data based on period
      const data = await this.fetchDashboardData(period);

      // Render dashboard
      this.renderDashboard(data, period);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      document.getElementById("dashboardContent").innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Gagal memuat dashboard: ${error.message}
                </div>
            `;
    }
  },

  // Fetch data from spreadsheet
  async fetchDashboardData(period) {
    // Get all patient data
    const allData = await sheetsAPI.getData("A2:I");

    // Filter based on period
    const filteredData = this.filterDataByPeriod(allData, period);

    // Calculate metrics
    const metrics = this.calculateMetrics(filteredData, allData);

    return {
      period,
      data: filteredData,
      allData: allData,
      metrics: metrics,
    };
  },

  // Filter data by period
  filterDataByPeriod(data, period) {
    const now = new Date();

    switch (period) {
      case "today":
        return data.filter((patient) => this.isToday(patient[1]));
      case "week":
        return data.filter((patient) => this.isThisWeek(patient[1]));
      case "month":
        return data.filter((patient) => this.isThisMonth(patient[1]));
      case "year":
        return data.filter((patient) => this.isThisYear(patient[1]));
      default:
        return data;
    }
  },

  // Filter data by custom month
  filterDataByCustomMonth(data, year, month) {
    return data.filter((patient) => {
      const patientDate = patient[1]; // Kolom tanggal

      if (!patientDate) return false;

      try {
        // Parse tanggal pasien
        const parsedDate = this.parseDate(patientDate);
        if (!parsedDate) return false;

        // Cek apakah tahun dan bulan sama
        return (
          parsedDate.getFullYear() === year &&
          parsedDate.getMonth() + 1 === month
        );
      } catch (e) {
        console.log("Error parsing date for filtering:", patientDate, e);
        return false;
      }
    });
  },

  // Render dashboard untuk bulan custom
  renderCustomMonthDashboard(data, metrics, yearMonth) {
    const [year, month] = yearMonth.split("-").map(Number);
    const monthName = this.getMonthName(month);

    // Update dashboard header
    const header = document.querySelector(".dashboard-header h4");
    if (header) {
      header.innerHTML = `<i class="fas fa-tachometer-alt me-2"></i>Dashboard - ${monthName} ${year}`;
    }

    // Render dashboard content
    this.renderDashboard(
      {
        period: "custom",
        data: data,
        allData: data, // Untuk konsistensi
        metrics: metrics,
      },
      "custom"
    );

    // Show success message
    this.showDashboardMessage(
      `Menampilkan data ${monthName} ${year}: ${data.length} pasien ditemukan`,
      "success"
    );
  },

  // Helper functions untuk bulan custom
  getMonthName(monthNumber) {
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return months[monthNumber - 1] || "Bulan tidak valid";
  },

  // Show loading state
  showDashboardLoading(message = "Memuat data...") {
    const content = document.getElementById("dashboardContent");
    if (content) {
      content.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">${message}</p>
            </div>
        `;
    }
  },

  // Show message in dashboard
  showDashboardMessage(message, type = "info") {
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
        <i class="fas ${
          type === "success"
            ? "fa-check-circle"
            : type === "error"
            ? "fa-exclamation-triangle"
            : type === "warning"
            ? "fa-exclamation-circle"
            : "fa-info-circle"
        } me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const dashboardContent = document.getElementById("dashboardContent");
    if (dashboardContent) {
      dashboardContent.insertBefore(messageDiv, dashboardContent.firstChild);

      // Auto remove after 5 seconds
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 5000);
    }
  },

  // Date helper functions
  isToday(dateStr) {
    const patientDate = this.parseDate(dateStr);
    if (!patientDate) return false;

    const today = new Date();
    return patientDate.toDateString() === today.toDateString();
  },

  isThisWeek(dateStr) {
    const patientDate = this.parseDate(dateStr);
    if (!patientDate) return false;

    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    return patientDate >= startOfWeek && patientDate <= endOfWeek;
  },

  isThisMonth(dateStr) {
    const patientDate = this.parseDate(dateStr);
    if (!patientDate) return false;

    const now = new Date();
    return (
      patientDate.getMonth() === now.getMonth() &&
      patientDate.getFullYear() === now.getFullYear()
    );
  },

  isThisYear(dateStr) {
    const patientDate = this.parseDate(dateStr);
    if (!patientDate) return false;

    const now = new Date();
    return patientDate.getFullYear() === now.getFullYear();
  },

  parseDate(dateStr) {
    if (!dateStr) return null;

    try {
      // Format DD/MM/YY
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

      // Try default Date parsing
      return new Date(dateStr);
    } catch (e) {
      return null;
    }
  },

  // Calculate metrics
  calculateMetrics(filteredData, allData) {
    const total = filteredData.length;
    const served = filteredData.filter(
      (p) => p[7] && p[7].trim().length > 0
    ).length;
    const pending = total - served;

    // Categorize by service type (analyze therapy column)
    const serviceTypes = this.analyzeServiceTypes(filteredData);

    // Age distribution
    const ageDistribution = this.calculateAgeDistribution(filteredData);

    // Patient categories (from complaint/therapy)
    const patientCategories = this.categorizePatients(filteredData);

    return {
      total,
      served,
      pending,
      serviceTypes,
      ageDistribution,
      patientCategories,
      // Add more metrics as needed
    };
  },

  // Analyze service types from therapy column
  analyzeServiceTypes(data) {
    const services = {};

    data.forEach((patient) => {
      const therapy = (patient[7] || "").toLowerCase();

      // Simple keyword matching (bisa dikembangkan lebih canggih)
      if (therapy.includes("anc") || therapy.includes("hamil")) {
        services["ANC"] = (services["ANC"] || 0) + 1;
      }
      if (therapy.includes("pnc") || therapy.includes("nifas")) {
        services["PNC"] = (services["PNC"] || 0) + 1;
      }
      if (therapy.includes("kb") || therapy.includes("kontrasepsi")) {
        services["KB"] = (services["KB"] || 0) + 1;
      }
      if (therapy.includes("imunisasi") || therapy.includes("vaksin")) {
        services["Imunisasi"] = (services["Imunisasi"] || 0) + 1;
      }
      if (therapy.includes("periksa") || therapy.includes("kontrol")) {
        services["Kontrol"] = (services["Kontrol"] || 0) + 1;
      }
      // Add more patterns as needed
    });

    // Sort by count
    return Object.entries(services)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5
  },

  // Calculate age distribution
  // Di dashboard.js, update fungsi calculateAgeDistribution
  calculateAgeDistribution(data) {
    const distribution = {
      bayi: 0, // < 1 tahun
      balita: 0, // 1-5 tahun
      anak: 0, // 6-12 tahun
      remaja: 0, // 13-19 tahun
      dewasaMuda: 0, // 20-35 tahun
      dewasa: 0, // 36-55 tahun
      lansia: 0, // 55+ tahun
      tidakDiketahui: 0,
    };

    data.forEach((patient) => {
      const ageStr = patient[5] || "";

      if (!ageStr || ageStr.trim() === "") {
        distribution.tidakDiketahui++;
        return;
      }

      const category = ageParser.categorizeSimple(ageStr);

      switch (category) {
        case "bayi":
          distribution.bayi++;
          break;
        case "balita":
          distribution.balita++;
          break;
        case "anak":
          distribution.anak++;
          break;
        case "remaja":
          distribution.remaja++;
          break;
        case "dewasa-muda":
          distribution.dewasaMuda++;
          break;
        case "dewasa":
          distribution.dewasa++;
          break;
        case "lansia":
          distribution.lansia++;
          break;
        default:
          distribution.tidakDiketahui++;
      }
    });

    return distribution;
  },

  // Fungsi baru untuk statistik usia
  calculateAgeStatistics(data) {
    const stats = {
      total: 0,
      validEntries: 0,
      invalidEntries: 0,
      ageGroups: {},
      averageAge: 0,
      minAge: Infinity,
      maxAge: 0,
      mostCommonAge: null,
    };

    const ageCounts = {};
    let totalYears = 0;
    let totalMonths = 0;

    data.forEach((patient) => {
      stats.total++;
      const ageStr = patient[5] || "";

      if (!ageStr || ageStr.trim() === "") {
        stats.invalidEntries++;
        return;
      }

      const parsed = ageParser.parseAge(ageStr);

      if (!parsed.isValid) {
        stats.invalidEntries++;
        return;
      }

      stats.validEntries++;

      // Hitung total untuk rata-rata
      const totalMonthsPatient = parsed.years * 12 + parsed.months;
      totalMonths += totalMonthsPatient;

      // Hitung min/max
      const totalYearsPatient = parsed.years + parsed.months / 12;
      stats.minAge = Math.min(stats.minAge, totalYearsPatient);
      stats.maxAge = Math.max(stats.maxAge, totalYearsPatient);

      // Hitung frekuensi usia
      const roundedAge = Math.round(totalYearsPatient);
      ageCounts[roundedAge] = (ageCounts[roundedAge] || 0) + 1;

      // Kategorikan
      const category = ageParser.categorizeSimple(ageStr);
      stats.ageGroups[category] = (stats.ageGroups[category] || 0) + 1;
    });

    // Hitung rata-rata
    if (stats.validEntries > 0) {
      stats.averageAge = totalMonths / stats.validEntries / 12; // dalam tahun
    }

    // Cari usia paling umum
    let maxCount = 0;
    let mostCommon = null;
    for (const [age, count] of Object.entries(ageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = age;
      }
    }
    stats.mostCommonAge = mostCommon;

    // Handle infinite values
    if (stats.minAge === Infinity) stats.minAge = 0;
    if (stats.maxAge === -Infinity) stats.maxAge = 0;

    return stats;
  },

  // Categorize patients
  categorizePatients(data) {
    const categories = {
      pregnant: 0,
      postpartum: 0,
      kb: 0,
      general: 0,
    };

    data.forEach((patient) => {
      const complaint = (patient[6] || "").toLowerCase();
      const therapy = (patient[7] || "").toLowerCase();

      if (complaint.includes("hamil") || therapy.includes("anc")) {
        categories.pregnant++;
      } else if (complaint.includes("nifas") || therapy.includes("pnc")) {
        categories.postpartum++;
      } else if (complaint.includes("kb") || therapy.includes("kontrasepsi")) {
        categories.kb++;
      } else {
        categories.general++;
      }
    });

    return categories;
  },

  // Render dashboard
  renderDashboard(data, period) {
    const { metrics } = data;

    // Hitung statistik usia
    const ageStats = this.calculateAgeStatistics(data.data);

    let dashboardHTML = `
            <!-- Today's Snapshot -->
            <div class="dashboard-card">
                <h4><i class="fas fa-calendar-day"></i> Ringkasan ${this.getPeriodName(
                  period
                )}</h4>
                
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-card bg-primary">
                            <i class="fas fa-user-injured"></i>
                            <h3>${metrics.total}</h3>
                            <p>Total Pasien</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card bg-success">
                            <i class="fas fa-check-circle"></i>
                            <h3>${metrics.served}</h3>
                            <p>Sudah Dilayani</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card bg-warning">
                            <i class="fas fa-clock"></i>
                            <h3>${metrics.pending}</h3>
                            <p>Menunggu Layanan</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card bg-info">
                            <i class="fas fa-baby"></i>
                            <h3>${metrics.patientCategories.pregnant}</h3>
                            <p>Ibu Hamil</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Top Services -->
            <div class="dashboard-card">
                <h4><i class="fas fa-stethoscope"></i> Layanan Terbanyak</h4>
                
                <div class="row">
                    <div class="col-md-6">
                        <table class="table table-sm">
                            <thead>
                                <tr><th>Jenis Layanan</th><th>Jumlah</th></tr>
                            </thead>
                            <tbody>
        `;

    // Add top services
    metrics.serviceTypes.forEach(([service, count]) => {
      dashboardHTML += `
                <tr>
                    <td>${service}</td>
                    <td><span class="badge bg-primary">${count}</span></td>
                </tr>
            `;
    });

    dashboardHTML += `
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="demographic-card">
                        <h5>Statistik Usia</h5>
                        <ul class="list-unstyled">
                            <li class="mb-2">
                                <div class="d-flex justify-content-between w-100">
                                    <span>Rata-rata: </span> 
                                    <strong> ${ageStats.averageAge.toFixed(
                                      1
                                    )} tahun</strong>
                                </div>
                            </li>
                            <li class="mb-2">
                                <div class="d-flex justify-content-between w-100">
                                    <span>Termuda:</span>
                                    <strong>${ageStats.minAge.toFixed(
                                      1
                                    )} tahun</strong>
                                </div>
                            </li>
                            <li class="mb-2">
                                <div class="d-flex justify-content-between w-100">
                                    <span>Tertua:</span>
                                    <strong>${ageStats.maxAge.toFixed(
                                      1
                                    )} tahun</strong>
                                </div>
                            </li>
                            <li class="mb-2">
                                <div class="d-flex justify-content-between w-100">
                                    <span>Usia Paling Umum:</span>
                                    <strong>${
                                      ageStats.mostCommonAge || "-"
                                    } tahun</strong>
                                </div>
                            </li>
                            <li class="mb-2">
                                <div class="d-flex justify-content-between w-100">
                                    <span>Data Valid:</span>
                                    <span class="badge ${
                                      ageStats.validEntries > 0
                                        ? "bg-success"
                                        : "bg-warning"
                                    }">
                                        ${ageStats.validEntries}/${
      ageStats.total
    }
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <!-- Distribusi Kategori -->
                <div class="col-md-8">
                    <div class="row">
                        ${this.renderAgeCategories(
                          ageStats.ageGroups,
                          ageStats.validEntries
                        )}
                    </div>
                    </div>
                </div>
            </div>
            
            <!-- Patient Categories -->
            <div class="dashboard-card">
                <h4><i class="fas fa-users"></i> Kategori Pasien</h4>
                
                <div class="row">
                    <div class="col-md-3">
                        <div class="text-center p-3 border rounded">
                            <i class="fas fa-baby-carriage fa-2x text-success mb-2"></i>
                            <h4>${metrics.patientCategories.pregnant}</h4>
                            <p class="mb-0">Ibu Hamil</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center p-3 border rounded">
                            <i class="fas fa-child fa-2x text-info mb-2"></i>
                            <h4>${metrics.patientCategories.postpartum}</h4>
                            <p class="mb-0">Nifas</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center p-3 border rounded">
                            <i class="fas fa-pills fa-2x text-primary mb-2"></i>
                            <h4>${metrics.patientCategories.kb}</h4>
                            <p class="mb-0">KB</p>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-center p-3 border rounded">
                            <i class="fas fa-user-md fa-2x text-warning mb-2"></i>
                            <h4>${metrics.patientCategories.general}</h4>
                            <p class="mb-0">Umum</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="dashboard-card">
                <h4><i class="fas fa-history"></i> Aktivitas Terbaru</h4>
                
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Nama Pasien</th>
                                <th>Layanan</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

    // Add recent activities (last 5 patients)
    const recentPatients = data.data.slice(-5).reverse();
    recentPatients.forEach((patient) => {
      const isServed = patient[7] && patient[7].trim().length > 0;
      const dateFormatted = this.formatDateForDashboard(patient[1]);

      dashboardHTML += `
                <tr>
                    <td>${dateFormatted.date}</td>
                    <td><strong>${escapeHtml(patient[2] || "")}</strong></td>
                    <td>${escapeHtml(patient[7] || "Belum ada terapi")}</td>
                    <td>
                        <span class="badge ${
                          isServed ? "bg-success" : "bg-warning"
                        }">
                            ${isServed ? "Selesai" : "Menunggu"}
                        </span>
                    </td>
                </tr>
            `;
    });

    dashboardHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    document.getElementById("dashboardContent").innerHTML = dashboardHTML;
  },

  // Fungsi baru untuk render kategori usia
  renderAgeCategories(ageGroups, totalValid) {
    const categories = [
      { key: "bayi", name: "Bayi (<1 th)", color: "info" },
      { key: "balita", name: "Balita (1-5 th)", color: "primary" },
      { key: "anak", name: "Anak (6-12 th)", color: "success" },
      { key: "remaja", name: "Remaja (13-19 th)", color: "warning" },
      {
        key: "dewasa-muda",
        name: "Dewasa Muda (20-35 th)",
        color: "secondary",
      },
      { key: "dewasa", name: "Dewasa (36-55 th)", color: "dark" },
      { key: "lansia", name: "Lansia (55+ th)", color: "danger" },
      { key: "tidak-diketahui", name: "Tidak Diketahui", color: "light" },
    ];

    let html = "";

    categories.forEach((cat) => {
      const count = ageGroups[cat.key] || 0;
      const percentage =
        totalValid > 0 ? ((count / totalValid) * 100).toFixed(1) : 0;

      html += `
            <div class="col-md-6 mb-3">
                <div class="d-flex justify-content-between align-items-center p-2 border rounded">
                    <div>
                        <span class="badge bg-${cat.color} me-2">${count}</span>
                        <span class="small">${cat.name}</span>
                    </div>
                    <div class="text-end">
                        <div class="text-muted very-small">${percentage}%</div>
                        <div class="progress" style="width: 60px; height: 4px;">
                            <div class="progress-bar bg-${cat.color}" 
                                 style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    return html;
  },

  // Format date for dashboard display
  formatDateForDashboard(dateStr) {
    const date = this.parseDate(dateStr);
    if (!date) return { date: "-" };

    // Format tanggal: "Kamis, 26 Des 2024"
    const dateFormatted = date.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return {
      date: dateFormatted,
    };
  },

  // Helper functions
  getPeriodName(period) {
    const names = {
      today: "Hari Ini",
      week: "Minggu Ini",
      month: "Bulan Ini",
      year: "Tahun Ini",
    };
    return names[period] || period;
  },

  formatTime(dateStr) {
    const date = this.parseDate(dateStr);
    if (!date) return "-";

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  // Load custom month
  async loadCustomMonthData(yearMonth) {
    try {
      // Validasi input
      if (!yearMonth || !yearMonth.match(/^\d{4}-\d{2}$/)) {
        console.error("Format bulan tidak valid:", yearMonth);
        this.showDashboardMessage(
          "Format bulan tidak valid. Gunakan format: YYYY-MM",
          "error"
        );
        return;
      }

      //   console.log("📅 Loading data for:", yearMonth);

      // Parse tahun dan bulan
      const [year, month] = yearMonth.split("-").map(Number);

      // Show loading
      this.showDashboardLoading(
        `Memuat data untuk ${this.getMonthName(month)} ${year}...`
      );

      // Get all patient data
      const allData = await sheetsAPI.getData("A2:I");

      if (!allData || allData.length === 0) {
        this.showDashboardMessage("Tidak ada data pasien ditemukan", "warning");
        return;
      }

      // Filter data untuk bulan yang dipilih
      const filteredData = this.filterDataByCustomMonth(allData, year, month);

      // Calculate metrics
      const metrics = this.calculateMetrics(filteredData, allData);

      // Render dashboard dengan data filtered
      this.renderCustomMonthDashboard(filteredData, metrics, yearMonth);
    } catch (error) {
      console.error("❌ Error loading custom month data:", error);
      this.showDashboardMessage("Gagal memuat data: " + error.message, "error");
    }
  },
};

// Initialize dashboard when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  // Give time for other scripts to load
  setTimeout(() => {
    dashboard.init();
  }, 1000);
});

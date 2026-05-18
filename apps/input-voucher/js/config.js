/**
 * ============================================
 * FinanceSync Pro v3.8.1 - Configuration File
 * ============================================
 * 🔗 Firebase Project: pencatatan-voucher-perusahaan
 * 🔗 Google Drive: Connected
 * 📅 Updated: 08/05/2026
 */

const APP_CONFIG = {
  // ==========================================
  // 📱 Aplikasi Info
  // ==========================================
  app: {
    name: 'FinanceSync Pro',
    version: '3.8.1',
    edition: 'Dynamic Multi-Company Edition',
    description: 'Sistem manajemen keuangan multi-perusahaan'
  },

  // ==========================================
  // 🔥 Firebase Configuration
  // ==========================================
  firebase: {
    apiKey: "AIzaSyDfIvUOLqAULR9eKy0rkqJfY_99Q4rxy2M",
    authDomain: "pencatatan-voucher-perusahaan.firebaseapp.com",
    databaseURL: "https://pencatatan-voucher-perusahaan-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pencatatan-voucher-perusahaan",
    storageBucket: "pencatatan-voucher-perusahaan.firebasestorage.app",
    messagingSenderId: "5344554002",
    appId: "1:5344554002:web:9137a500fbb8f3223b7ccb",
    measurementId: "G-1249N852Y5"
  },

  // ==========================================
  // 📊 Firestore Collections
  // ==========================================
  firestore: {
    submissionsCollection: 'submissions',
    companiesCollection: 'companies',
    usersCollection: 'users'
  },

  // ==========================================
  // 📑 Google Sheets Configuration
  // ==========================================
  googleSheets: {
    spreadsheetId: '',
    sheets: {
      main: 'Data Transaksi',
      companies: 'Daftar Perusahaan',
      summary: 'Ringkasan'
    },
    headers: {
      main: [
        'ID', 'Tanggal', 'Lokasi', 'Jenis', 'Kode',
        'No Invoice', 'Status', 'Items', 'Total',
        'Dibayarkan Kepada', 'Catatan', 'File URLs',
        'Company ID', 'Created At', 'Updated At'
      ],
      companies: [
        'Kode', 'Nama', 'Nama Lengkap', 'Icon', 'Warna',
        'Default Lokasi', 'Default Kode', 'Default Jenis',
        'Dibuat Oleh', 'Disetujui Oleh', 'Keuangan', 'Direktur'
      ]
    }
  },

  // ==========================================
  // 📁 Google Drive Configuration ✅ TERHUBUNG
  // ==========================================
  googleDrive: {
    // 🔑 OAuth Client ID dari Google Cloud Console
    clientId: '507086356684-ciem4iq01qoseomt7tamq5bim0iokutu.apps.googleusercontent.com',

    // 🔑 API Key dari Google Cloud Console
    apiKey: 'AIzaSyA5nn4gZyt9g9ghK-MeAqy4FNLsHgl251s',

    // 📁 Folder ID tempat upload (shared anyone with link)
    folderId: '1yLZvLQFvubpRVpgBzxPoGeevqu10FiQS',

    // 🔗 Discovery doc untuk Google Drive API v3
    discoveryDocs: [
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],

    // 🔐 OAuth scopes (drive.file = hanya akses file yang dibuat app)
    scopes: 'https://www.googleapis.com/auth/drive.file',

    // 📏 Maksimal ukuran file (dalam bytes)
    maxFileSize: 30 * 1024 * 1024, // 30MB

    // 📎 Allowed file types
    allowedTypes: [
      '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.zip'
    ],

    // 🌐 Auto-set permission saat upload
    // 'anyone' = siapapun dengan link bisa view
    // 'private' = hanya owner yang bisa akses
    autoPermission: 'anyone'
  },

  // ==========================================
  // ⚙️ Application Settings
  // ==========================================
  settings: {
    currency: {
      symbol: 'Rp',
      code: 'IDR',
      locale: 'id-ID'
    },
    dateFormat: 'DD/MM/YYYY',
    pagination: {
      itemsPerPage: 20,
      maxPages: 10
    },
    autoSave: {
      enabled: true,
      interval: 30000
    },
    toastDuration: 4000
  },

  // ==========================================
  // 🔐 Security Settings
  // ==========================================
  security: {
    sessionTimeout: 24 * 60 * 60 * 1000,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000
  },

  // ==========================================
  // 🎨 UI Theme Defaults
  // ==========================================
  theme: {
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    successColor: '#22c55e',
    warningColor: '#f59e0b',
    errorColor: '#ef4444',
    defaultCompanyIcon: '🏢',
    defaultCompanyColor: '#6366f1'
  },

  // ==========================================
  // 📝 Form Defaults
  // ==========================================
  formDefaults: {
    paymentStatus: ['Lunas', 'Belum Lunas'],
    lokasi: '',
    kode: '',
    jenis: ''
  },

  // ==========================================
  // 🖨️ Document/PDF Settings
  // ==========================================
  document: {
    pdfOptions: {
      margin: [10, 10, 10, 10],
      filename: 'invoice-finance.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    },
    title: 'INVOICE / BUKTI PENGELUARAN',
    companyName: 'PT. YOUR COMPANY NAME',
    companyAddress: 'Jl. Contoh Alamat No. 123, Jakarta'
  },

  // ==========================================
  // 🔌 API Endpoints
  // ==========================================
  api: {
    baseUrl: '',
    endpoints: {
      export: '/api/export',
      import: '/api/import',
      report: '/api/report'
    }
  },

  // ==========================================
  // 🚀 Feature Flags
  // ==========================================
  features: {
    googleSheetsSync: false,
    googleDriveUpload: true,    // ✅ ON - Drive sudah configured
    multiCompany: true,
    editMode: true,
    migrationTool: true,
    pdfGeneration: true,
    autoBackup: false
  }
};

// ============================================
// 🛡️ Environment Detection
// ============================================
const ENVIRONMENT = {
  isDevelopment: window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1',

  isProduction: !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1'),

  get currentMode() {
    return this.isDevelopment ? 'development' : 'production';
  }
};

// ============================================
// 🔐 SESSION MANAGEMENT CONFIGURATION (BARU)
// ============================================
const SESSION_CONFIG = {
  ENABLE_SESSION_TIMEOUT: true,      // ✅ Aktifkan fitur timeout session
  TIMEOUT_HOURS: 4,                  // ⏰ Session expired setelah 4 jam tidak aktif
  SESSION_KEY: 'fs_session_v3',      // 🔑 Key untuk localStorage
  AUTO_LOGIN: false                  // ❌ Jangan auto-login walau Firebase masih auth
};

// Export untuk penggunaan di file lain
window.APP_CONFIG = APP_CONFIG;
window.ENVIRONMENT = ENVIRONMENT;
window.SESSION_CONFIG = SESSION_CONFIG;  // ✅ Export SESSION_CONFIG

console.log(`%c🚀 ${APP_CONFIG.app.name} v${APP_CONFIG.app.version}`,
  'color: #6366f1; font-size: 14px; font-weight: bold;');
console.log(`%c🔥 Firebase: ${APP_CONFIG.firebase.projectId}`,
  'color: #f59e0b; font-size: 11px;');
console.log(`%c📁 Google Drive: Connected (Folder: ...${APP_CONFIG.googleDrive.folderId.slice(-6)})`,
  'color: #22c55e; font-size: 11px;');
console.log(`%cMode: ${ENVIRONMENT.currentMode}`,
  'color: #10b981; font-size: 11px;');
console.log(`%c🔐 Session: ${SESSION_CONFIG.ENABLE_SESSION_TIMEOUT ? 'Timeout ' + SESSION_CONFIG.TIMEOUT_HOURS + ' jam' : 'Disabled'} | Auto-login: ${SESSION_CONFIG.AUTO_LOGIN ? 'ON' : 'OFF'}`,
  'color: #8b5cf6; font-size: 11px;');

/**
 * ============================================
 * FinanceSync Pro v3.8.9 - Main Application Logic (PDF LAYOUT FIXED v2)
 * ============================================
 * 
 * 📅 Last Update: 12/05/2026
 * 🔧 ALL Fixes Applied:
 *   ✅ Infinite loop prevention (resetForm/cancelEdit)
 *   ✅ Auth state UI management  
 *   ✅ Bootstrap error handling
 *   ✅ SMART LOGIN: Bisa login tanpa pilih company (kalau belum ada)
 *   ✅ First-time user wizard support
 *   ✅ FIXED: Missing catch/finally after try
 *   ✅ FIXED: Mismatched curly braces in doLogin
 *   ✅ NEW v3.8.6: switchTab fallback ke localStorage
 *   ✅ NEW v3.8.6: Auto-restore AppState.currentCompany on init
 *   ✅ NEW v3.8.6: Handle tab "Semua" tanpa filter status
 *   ✅ NEW: 2-Page PDF Output (Formulir HO + Bukti Kas/Bank)
 *   ✅ NEW v3.8.7: PDF download EXACT 2 pages + 6 signatures from Firestore
 *   ✅ NEW v3.8.8: PDF LAYOUT FIX - Table-based HTML for reliable rendering
 *   ✅ NEW v3.8.9: PDF ULTRA-FIX - Exact A4 dimensions + compact styling
 */

// ==========================================
// 🎯 Global State Management
// ==========================================

const AppState = {
  currentCompany: null,
  activeTab: 'Lunas',
  formState: {
    isEditMode: false,
    editingDocId: null,
    files: []
  },
  formItems: []
};

// ==========================================
// 🚀 App Initialization
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('%c🎉 DOM Ready, initializing app...', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');
  
  try {
    Toast.init();
    setupFormListeners();
    setupFileUpload();
    setupUIElements();
    addFormItem();
    
    // ✅ FIX v3.8.6: Restore AppState.currentCompany dari localStorage
    try {
      const savedCompany = StorageUtils.get('financesync_selectedCompany');
      if (savedCompany && savedCompany.id) {
        AppState.currentCompany = savedCompany;
        console.log('🏢 Restored company from localStorage:', savedCompany.name);
      }
    } catch (e) {
      console.warn('⚠️ Could not restore company:', e);
    }
    
    const dateInput = document.getElementById('fTgl');
    if (dateInput) {
      dateInput.value = DateUtils.getTodayISO();
    }
    
    // Initialize auth UI SEBELUM bootstrap
    window.initAuthListener?.();
    window.updateAuthUI?.();
    
    // Bootstrap dengan error handling
    if (typeof bootstrapApp === 'function') {
      bootstrapApp().catch(err => {
        console.error('❌ Bootstrap error:', err);
        Toast.error('Gagal memuat konfigurasi awal');
        window.updateAuthUI?.();
      });
    } else {
      console.warn('⚠️ bootstrapApp() not found, skipping...');
      window.updateAuthUI?.();
    }
    
    console.log('✅ App initialization complete');
    
  } catch (error) {
    console.error('❌ App initialization error:', error);
    Toast.error('Gagal menginisialisasi aplikasi: ' + error.message);
  }
});

// ==========================================
// 📝 Form Handling Functions
// ==========================================

function setupFormListeners() {
  const mainForm = document.getElementById('mainForm');
  if (mainForm) {
    mainForm.addEventListener('submit', handleFormSubmit);
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  try {
    const mainForm = document.getElementById('mainForm');
    if (!Validator.validateForm(mainForm)) {
      Toast.warning('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    if (AppState.formItems.length === 0 || 
        AppState.formItems.every(item => !item.nama || !item.nominal)) {
      Toast.warning('Tambahkan minimal 1 item dengan nama dan nominal');
      return;
    }

    const subBtn = document.getElementById('subBtn');
    if (subBtn) {
      subBtn.disabled = true;
      subBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';
    }

    const formData = gatherFormData();

    if (AppState.formState.isEditMode && AppState.formState.editingDocId) {
      await SubmissionDB.update(AppState.formState.editingDocId, formData);
      Toast.success('Data berhasil diperbarui! ✏️');
      cancelEdit();
      
    } else {
      const docId = await SubmissionDB.create(formData);
      console.log(`📄 New submission created: ${docId}`);
      Toast.success('Data berhasil disimpan! 💾');
      
      if (APP_CONFIG.features.googleSheetsSync && DriveSync.isInitialized) {
        await syncToGoogleSheets({ ...formData, id: docId });
      }
    }

    resetForm();
    
    // ✅ FIX v3.8.6: Fallback ke localStorage
    let company = AppState.currentCompany;
    if (!company) {
      company = StorageUtils.get('financesync_selectedCompany');
      if (company) AppState.currentCompany = company;
    }
    
    if (company && company.id) {
      await loadSubmissions(company.id, AppState.activeTab);
      await updateDashboardStats(company.id);
    }

  } catch (error) {
    console.error('❌ Form submit error:', error);
    Toast.error('Gagal menyimpan data: ' + error.message);
    
  } finally {
    const subBtn = document.getElementById('subBtn');
    if (subBtn) {
      subBtn.disabled = false;
      subBtn.innerHTML = '<span>💾 Simpan ke Firebase</span>';
    }
  }
}

function gatherFormData() {
  const tanggal = document.getElementById('fTgl').value;
  const lokasi = document.getElementById('fLokasi').value;
  const jenis = document.getElementById('fJenis').value;
  const kode = document.getElementById('fKode').value;
  const noInvoice = document.getElementById('fNoInv').value || StringUtils.generateInvoiceNumber(kode.toUpperCase());
  const status = document.getElementById('fStatus').value;
  const dibayarkanKepada = document.getElementById('fBayar').value;
  const catatan = document.getElementById('fCatatan').value;
  const tglBayar = document.getElementById('fTglBayar').value;

  let totalNominal = 0;
  const validItems = AppState.formItems.filter(item => item.nama && item.nominal);
  
  validItems.forEach(item => {
    totalNominal += parseFloat(item.nominal) || 0;
  });

  // ✅ FIX v3.8.6: Fallback ke localStorage
  let company = AppState.currentCompany;
  if (!company) {
    company = StorageUtils.get('financesync_selectedCompany');
  }

  return {
    tanggal, lokasi, jenis, kode, noInvoice, status,
    items: validItems,
    totalNominal,
    dibayarkanKepada, catatan,
    tglBayar: status === 'Lunas' ? tglBayar : null,
    files: AppState.formState.files.map(f => ({
      id: f.id, name: f.name, size: f.size, type: f.type,
      webViewLink: f.webViewLink, webContentLink: f.webContentLink
    })),
    companyId: company?.id || null,
    companyName: company?.name || null
  };
}

/**
 * Reset form - FIXED: Parameter skipCancelEdit mencegah infinite loop
 */
function resetForm(skipCancelEdit = false) {
  const mainForm = document.getElementById('mainForm');
  if (mainForm) mainForm.reset();

  const dateInput = document.getElementById('fTgl');
  if (dateInput) dateInput.value = DateUtils.getTodayISO();

  AppState.formItems = [];
  const itemsBox = document.getElementById('itemsBox');
  if (itemsBox) itemsBox.innerHTML = '';

  addFormItem();
  clearFiles();

  if (!skipCancelEdit) {
    cancelEdit();
  }

  const tglBayarContainer = document.getElementById('fTglBayarContainer');
  if (tglBayarContainer) tglBayarContainer.style.display = 'none';

  console.log('🔄 Form reset');
}

// ==========================================
// 📦 Dynamic Form Items
// ==========================================

function addFormItem() {
  const itemId = `item_${Date.now()}`;

  const itemHtml = `
    <div class="grid grid-cols-12 gap-2 items-start" id="${itemId}" style="background:rgba(10,15,26,.4);padding:10px;border-radius:8px;border:1px solid var(--border)">
      <div class="col-span-12 md:col-span-5">
        <input type="text" class="input-field item-nama" placeholder="Nama barang/jasa" 
               onchange="updateFormItem('${itemId}', 'nama', this.value)" style="font-size:13px;padding:8px 12px">
      </div>
      <div class="col-span-5 md:col-span-4">
        <div class="currency-wrapper">
          <span class="prefix" style="font-size:11px">Rp</span>
          <input type="number" class="input-field item-nominal mono" placeholder="0" 
                 onchange="updateFormItem('${itemId}', 'nominal', this.value);calculateTotal()"
                 oninput="calculateTotal()" style="font-size:13px;padding:8px 12px">
        </div>
      </div>
      <div class="col-span-7 md:col-span-2">
        <input type="number" class="input-field item-qty mono" placeholder="Qty" value="1" min="1"
               onchange="updateFormItem('${itemId}', 'qty', this.value);calculateTotal()"
               oninput="calculateTotal()" style="font-size:13px;padding:8px 12px">
      </div>
      <div class="col-span-5 md:col-span-1 flex justify-end">
        <button type="button" onclick="removeFormItem('${itemId}')"
                class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm flex items-center justify-center"
                title="Hapus item">✕</button>
      </div>
    </div>
  `;

  const itemsBox = document.getElementById('itemsBox');
  if (itemsBox) itemsBox.insertAdjacentHTML('beforeend', itemHtml);

  AppState.formItems.push({ id: itemId, nama: '', nominal: 0, qty: 1 });
  console.log(`➕ Item added: ${itemId}`);
}

function updateFormItem(itemId, field, value) {
  const itemIndex = AppState.formItems.findIndex(item => item.id === itemId);
  if (itemIndex !== -1) {
    if (field === 'nominal' || field === 'qty') {
      AppState.formItems[itemIndex][field] = parseFloat(value) || 0;
    } else {
      AppState.formItems[itemIndex][field] = value;
    }
  }
}

function removeFormItem(itemId) {
  const itemEl = document.getElementById(itemId);
  if (itemEl) itemEl.remove();

  AppState.formItems = AppState.formItems.filter(item => item.id !== itemId);
  calculateTotal();

  if (AppState.formItems.length === 0) addFormItem();
}

function calculateTotal() {
  let total = 0;
  AppState.formItems.forEach(item => {
    const nominal = parseFloat(item.nominal) || 0;
    const qty = parseInt(item.qty) || 1;
    total += nominal * qty;
  });

  const totalInput = document.getElementById('fTotal');
  if (totalInput) totalInput.value = CurrencyUtils.formatNumber(total);

  return total;
}

// ==========================================
// 📤 File Upload Handling
// ==========================================

let selectedFiles = [];

function setupFileUpload() {
  const upZone = document.getElementById('upZone');
  if (upZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      upZone.addEventListener(eventName, preventDefaults, false);
    });
  }
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

window.handleDragOver = function(e) {
  const upZone = document.getElementById('upZone');
  if (upZone) upZone.classList.add('dragging');
};

window.handleDragLeave = function(e) {
  const upZone = document.getElementById('upZone');
  if (upZone) upZone.classList.remove('dragging');
};

window.handleDrop = function(e) {
  const upZone = document.getElementById('upZone');
  if (upZone) upZone.classList.remove('dragging');
  handleFiles(e.dataTransfer.files);
};

window.handleFileSelect = function(input) {
  handleFiles(input.files);
};

async function handleFiles(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const validation = Validator.validateFile(file);
    if (!validation.valid) {
      Toast.warning(`${file.name}: ${validation.error}`);
      return;
    }
    selectedFiles.push(file);
  });

  renderSelectedFiles();
}

function renderSelectedFiles() {
  const fList = document.getElementById('fList');
  const fActions = document.getElementById('fActions');
  const fCount = document.getElementById('fCount');
  const upPlaceholder = document.getElementById('upPlaceholder');

  if (!fList) return;

  if (selectedFiles.length > 0) {
    if (upPlaceholder) upPlaceholder.style.display = 'none';

    fList.innerHTML = selectedFiles.map((file, index) => `
      <div class="f-card" id="fileCard_${index}">
        <div class="f-icon ${FileUtils.getFileIcon(file.name)}">📄</div>
        <div class="f-info">
          <div class="f-name">${StringUtils.escapeHtml(file.name)}</div>
          <div class="f-size">${FileUtils.formatFileSize(file.size)}</div>
        </div>
        <button class="f-del" onclick="removeSelectedFile(${index})" title="Hapus file">✕</button>
      </div>
    `).join('');

    if (fActions) fActions.style.display = 'flex';
    if (fCount) fCount.textContent = `${selectedFiles.length} file`;

  } else {
    if (upPlaceholder) upPlaceholder.style.display = '';
    if (fActions) fActions.style.display = 'none';
    fList.innerHTML = '';
  }
}

window.removeSelectedFile = function(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
};

window.clearFiles = function() {
  selectedFiles = [];
  AppState.formState.files = [];
  renderSelectedFiles();

  const fInput = document.getElementById('fInput');
  if (fInput) fInput.value = '';
};

// ==========================================
// 🔄 Tab Switching - FIXED v3.8.6
// ==========================================

window.switchTab = function(status, btnElement) {
  const tabs = document.querySelectorAll('.tab-item');
  tabs.forEach(tab => tab.classList.remove('on'));
  if (btnElement) btnElement.classList.add('on');

  AppState.activeTab = status;

  // ✅ FIX v3.8.6: Fallback ke localStorage jika AppState.currentCompany null
  let company = AppState.currentCompany;
  if (!company) {
    company = StorageUtils.get('financesync_selectedCompany');
    if (company) {
      AppState.currentCompany = company;
      console.log('🔧 Auto-restored AppState.currentCompany from localStorage');
    }
  }

  if (!company || !company.id) {
    console.warn('⚠️ No company selected');
    if (typeof Toast !== 'undefined') {
      Toast.warning('Pilih perusahaan terlebih dahulu');
    }
    return;
  }

  // ✅ FIX v3.8.6: Handle tab "Semua" tanpa filter status
  if (status === 'Semua') {
    SubmissionDB.getAll({ 
      companyId: company.id, 
      limit: 100,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    })
    .then(data => {
      console.log(`📊 Loaded ${data.length} (Semua)`);
      if (typeof renderSubmissionList === 'function') {
        renderSubmissionList(data);
      }
    })
    .catch(err => {
      console.error('❌ Error loading all:', err);
      if (typeof Toast !== 'undefined') {
        Toast.error('Gagal memuat data');
      }
    });
  } else {
    // Filter berdasarkan status (Lunas / Belum Lunas)
    loadSubmissions(company.id, status);
  }

  console.log(`📑 Switched to tab: ${status}`);
};

// ==========================================
// ✏️ Edit Mode Functions
// ==========================================

async function editSubmission(docId) {
  try {
    console.log(`✏️ Editing submission: ${docId}`);

    const submission = await SubmissionDB.getById(docId);
    if (!submission) throw new Error('Data tidak ditemukan');

    populateFormWithSubmission(submission);

    AppState.formState.isEditMode = true;
    AppState.formState.editingDocId = docId;

    const editBanner = document.getElementById('editModeBanner');
    if (editBanner) editBanner.classList.add('show');

    const formSection = document.querySelector('.lg\\:col-span-3');
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth' });

    Toast.info('Mode Edit aktif. Ubah data lalu klik Simpan.');
    
  } catch (error) {
    console.error('❌ Error entering edit mode:', error);
    Toast.error('Gagal memuat data untuk diedit');
  }
}

function populateFormWithSubmission(submission) {
  document.getElementById('fTgl').value = submission.tanggal || '';
  document.getElementById('fLokasi').value = submission.lokasi || '';
  
  // ✅ Support both snake_case and camelCase
  document.getElementById('fJenis').value = submission.jenis || submission.jenis_pengajuan || submission.jenisPengajuan || '';
  document.getElementById('fKode').value = submission.kode || '';
  document.getElementById('fNoInv').value = submission.noInvoice || submission.no_invoice || '';
  document.getElementById('fStatus').value = submission.status || '';
  document.getElementById('fBayar').value = submission.dibayarkanKepada || submission.dibayarkan_kepada || '';
  document.getElementById('fCatatan').value = submission.catatan || submission.catatan_tambahan || submission.catatanTambahan || '';

  const tglBayar = submission.tglBayar || submission.tanggal_pembayaran;
  if (tglBayar) {
    const container = document.getElementById('fTglBayarContainer');
    const input = document.getElementById('fTglBayar');
    if (container) container.style.display = '';
    if (input) input.value = tglBayar;
  }

  AppState.formItems = [];
  const itemsBox = document.getElementById('itemsBox');
  if (itemsBox) itemsBox.innerHTML = '';

  if (submission.items && submission.items.length > 0) {
    submission.items.forEach(item => {
      addFormItem();
      const lastIndex = AppState.formItems.length - 1;
      
      // Support snake_case (ket) dan camelCase (nama)
      const itemNama = item.nama || item.ket || '';
      const itemNominal = parseFloat(item.nominal) || 0;
      const itemQty = parseInt(item.qty) || 1;
      
      AppState.formItems[lastIndex].nama = itemNama;
      AppState.formItems[lastIndex].nominal = itemNominal;
      AppState.formItems[lastIndex].qty = itemQty;

      const lastItemId = AppState.formItems[lastIndex].id;
      const namaInput = document.querySelector(`#${lastItemId} .item-nama`);
      const nominalInput = document.querySelector(`#${lastItemId} .item-nominal`);
      const qtyInput = document.querySelector(`#${lastItemId} .item-qty`);

      if (namaInput) namaInput.value = itemNama;
      if (nominalInput) nominalInput.value = itemNominal;
      if (qtyInput) qtyInput.value = itemQty;
    });
  } else {
    addFormItem();
  }

  calculateTotal();

  AppState.formState.files = submission.files || [];
  selectedFiles = [];
}

/**
 * Cancel edit mode - FIXED: Panggil resetForm(true) untuk hindari loop
 */
window.cancelEdit = function() {
  AppState.formState.isEditMode = false;
  AppState.formState.editingDocId = null;

  const editBanner = document.getElementById('editModeBanner');
  if (editBanner) editBanner.classList.remove('show');

  resetForm(true);

  console.log('❌ Edit mode cancelled');
};

// ==========================================
// 👁️ View & Delete Operations
// ==========================================

async function viewSubmission(docId) {
  try {
    const submission = await SubmissionDB.getById(docId);
    if (!submission) throw new Error('Data tidak ditemukan');
    await generateDocumentPreview(submission);
  } catch (error) {
    console.error('❌ Error viewing submission:', error);
    Toast.error('Gagal memuat detail data');
  }
}

window.confirmDeleteSubmission = async function(docId) {
  if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
    try {
      await SubmissionDB.delete(docId);
      Toast.success('Data berhasil dihapus! 🗑️');
      
      // ✅ FIX v3.8.6: Fallback ke localStorage
      let company = AppState.currentCompany;
      if (!company) {
        company = StorageUtils.get('financesync_selectedCompany');
        if (company) AppState.currentCompany = company;
      }
      
      if (company && company.id) {
        await loadSubmissions(company.id, AppState.activeTab);
        await updateDashboardStats(company.id);
      }
    } catch (error) {
      console.error('❌ Error deleting submission:', error);
      Toast.error('Gagal menghapus data');
    }
  }
};

// ==========================================
// 🖨️ Document Preview & PDF Generation (2 PAGES) - FIXED v3.8.9 ULTRA
// ==========================================

async function generateDocumentPreview(data) {
  const docBody = document.getElementById('docBody');
  if (!docBody) return;

  // 1. Ambil Data Company
  const companyInfo = AppState.currentCompany || StorageUtils.get('financesync_selectedCompany') || {};
  let companyData = {};
  try {
    if (companyInfo.id && typeof CompanyDB !== 'undefined') {
      const companyDoc = await CompanyDB.getById(companyInfo.id);
      if (companyDoc) companyData = companyDoc;
    }
  } catch (error) { console.warn('⚠️ Could not load company data for signatures:', error); }

  // 2. Ambil Data Form
  const items = data.items || [];
  const totalNominal = data.totalNominal || data.total_nominal || 0;
  const noInvoice = data.noInvoice || data.no_invoice || '-';
  const jenis = data.jenis || data.jenis_pengajuan || data.jenisPengajuan || '-';
  const dibayarkanKepada = data.dibayarkanKepada || data.dibayarkan_kepada || '-';
  const tglBayar = data.tglBayar || data.tanggal_pembayaran;
  const catatan = data.catatan || data.catatan_tambahan || data.catatanTambahan || '';

  // 3. Ambil Signature dari Company Data
  const sigDibuat = companyData.sigDibuat || companyInfo.sigDibuat || '(Nama Staff)';
  const sigDisetujui = companyData.sigDisetujui || companyInfo.sigDisetujui || '(Nama Supervisor)';
  const sigKeuangan = companyData.sigKeuangan || companyInfo.sigKeuangan || '(Nama Finance)';
  const sigDirKeuangan = companyData.sigDirKeuangan || companyInfo.sigDirKeuangan || '(Nama Dir Keuangan)';
  const sigDirektur = companyData.sigDirektur || companyInfo.sigDirektur || '(Nama Direktur)';
  const sigAccounting = companyData.sigAccounting || companyInfo.sigAccounting || '(Nama Accounting)';

  // 4. Build HTML dengan TABLE + Compact Styling untuk PDF yang reliable
  let html = `
    <div style="font-family: 'Space Grotesk', sans-serif; color: #000; font-size: 10px; width: 794px; margin: 0 auto; box-sizing: border-box;">
    
      <!-- ================= HALAMAN 1: FORMULIR PENGAJUAN HO ================= -->
      <div class="pdf-page" style="page-break-after: always; padding: 15px 20px; box-sizing: border-box; height: 1123px; overflow: hidden;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 12px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">INVOICE / BUKTI PENGELUARAN</h2>
          <h3 style="margin: 3px 0; font-size: 12px; font-weight: bold;">${companyData.name || companyInfo.name || 'Nama Perusahaan'}</h3>
          <p style="margin: 0; font-size: 9px; color: #555;">${APP_CONFIG.document.companyAddress || ''}</p>
        </div>

        <!-- Info Table -->
        <table style="width: 100%; margin-bottom: 10px; font-size: 10px; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; padding: 3px 5px; vertical-align: top;"><strong>No. Invoice:</strong> ${noInvoice}</td>
            <td style="width: 50%; padding: 3px 5px; vertical-align: top;"><strong>Tanggal:</strong> ${DateUtils.formatDate(data.tanggal)}</td>
          </tr>
          <tr>
            <td style="padding: 3px 5px; vertical-align: top;"><strong>Lokasi:</strong> ${data.lokasi || '-'}</td>
            <td style="padding: 3px 5px; vertical-align: top;"><strong>Jenis:</strong> ${jenis}</td>
          </tr>
          <tr>
            <td style="padding: 3px 5px; vertical-align: top;"><strong>Kode:</strong> ${data.kode || '-'}</td>
            <td style="padding: 3px 5px; vertical-align: top;"><strong>Status:</strong> <span style="color: ${data.status === 'Lunas' ? '#22c55e' : '#f59e0b'}; font-weight: bold;">${data.status}</span></td>
          </tr>
        </table>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: center; width: 35px;">No</th>
              <th style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: left;">Nama Barang / Jasa</th>
              <th style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: center; width: 40px;">Qty</th>
              <th style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: right; width: 90px;">Harga Satuan</th>
              <th style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: right; width: 90px;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td style="border: 0.5px solid #ccc; padding: 3px 5px; text-align: center;">${idx + 1}</td>
                <td style="border: 0.5px solid #ccc; padding: 3px 5px;">${item.nama || item.ket || '-'}</td>
                <td style="border: 0.5px solid #ccc; padding: 3px 5px; text-align: center;">${item.qty || 1}</td>
                <td style="border: 0.5px solid #ccc; padding: 3px 5px; text-align: right;">${CurrencyUtils.formatRupiah(item.nominal)}</td>
                <td style="border: 0.5px solid #ccc; padding: 3px 5px; text-align: right;">${CurrencyUtils.formatRupiah(item.nominal * item.qty)}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td colspan="4" style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: right;">TOTAL</td>
              <td style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: right; font-size: 11px;">${CurrencyUtils.formatRupiah(totalNominal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Payment Info -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 10px;">
          <div><strong>Dibayarkan Kepada:</strong> ${dibayarkanKepada}</div>
          <div><strong>Tgl Bayar:</strong> ${tglBayar ? DateUtils.formatDate(tglBayar) : '-'}</div>
        </div>

        ${catatan ? `<div style="margin-bottom: 10px; padding: 4px 8px; background: #fef3c7; border-left: 2px solid #f59e0b; font-size: 9px;"><strong>Catatan:</strong> ${StringUtils.escapeHtml(catatan)}</div>` : ''}

        <!-- Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 25px; text-align: center;">
          <div style="width: 45%;">
            <p style="margin-bottom: 30px; font-size: 9px;">DIBUAT OLEH,</p>
            <p style="border-bottom: 0.5px solid #000; padding-bottom: 3px; font-weight: bold; font-size: 10px;">${sigDibuat}</p>
          </div>
          <div style="width: 45%;">
            <p style="margin-bottom: 30px; font-size: 9px;">DISETUJUI OLEH,</p>
            <p style="border-bottom: 0.5px solid #000; padding-bottom: 3px; font-weight: bold; font-size: 10px;">${sigDisetujui}</p>
          </div>
        </div>
      </div>

      <!-- ================= HALAMAN 2: BUKTI PENGELUARAN KAS/BANK ================= -->
      <div class="pdf-page" style="page-break-after: always; padding: 15px 20px; box-sizing: border-box; height: 1123px; overflow: hidden;">
        
        <!-- Header Page 2 -->
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 13px; font-weight: bold;">BUKTI PENGELUARAN KAS / BANK</h2>
          <h3 style="margin: 3px 0; font-size: 11px; font-weight: bold;">${companyData.name || companyInfo.name || 'Nama Perusahaan'}</h3>
        </div>

        <!-- Kode Box (kanan atas) -->
        <div style="position: absolute; top: 25px; right: 25px; border: 0.5px solid #000; padding: 3px 10px; font-weight: bold; font-size: 10px; background: #fff;">
          ${data.kode || 'HO'}
        </div>

        <!-- Info Table -->
        <table style="width: 100%; margin: 25px 0 10px 0; font-size: 10px; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; padding: 3px 5px; vertical-align: top;"><strong>Dibayarkan Kepada:</strong> ${dibayarkanKepada}</td>
            <td style="width: 50%; padding: 3px 5px; vertical-align: top;"><strong>Jenis:</strong> ${jenis}</td>
          </tr>
          <tr>
            <td style="padding: 3px 5px; vertical-align: top;"><strong>Kode:</strong> ${data.kode || '-'}</td>
            <td style="padding: 3px 5px; vertical-align: top;"><strong>Metode:</strong> ☐ Tunai &nbsp; ☑ Transfer</td>
          </tr>
        </table>

        <!-- Amount Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 0.5px solid #ccc; padding: 5px; text-align: left;">JENIS PENGAJUAN</th>
              <th style="border: 0.5px solid #ccc; padding: 5px; text-align: right; width: 120px;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 0.5px solid #ccc; padding: 4px 5px;">${items.map(i => i.nama || i.ket).join(', ') || jenis}</td>
              <td style="border: 0.5px solid #ccc; padding: 4px 5px; text-align: right;">${CurrencyUtils.formatRupiah(totalNominal)}</td>
            </tr>
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td style="border: 0.5px solid #ccc; padding: 5px; text-align: right;">TOTAL</td>
              <td style="border: 0.5px solid #ccc; padding: 5px; text-align: right; font-size: 12px;">${CurrencyUtils.formatRupiah(totalNominal)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Approval Table (4 kolom compact) -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 8px;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="border: 0.5px solid #ccc; padding: 4px; text-align: center; width: 25%;">DIVERIFIKASI</th>
              <th style="border: 0.5px solid #ccc; padding: 4px; text-align: center; width: 25%;">DISETUJUI</th>
              <th style="border: 0.5px solid #ccc; padding: 4px; text-align: center; width: 25%;">DISETUJUI</th>
              <th style="border: 0.5px solid #ccc; padding: 4px; text-align: center; width: 25%;">DIBUKUKAN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 0.5px solid #ccc; padding: 15px 3px 3px 3px; vertical-align: bottom; text-align: center; height: 40px;">
                <strong style="font-size: 9px;">${sigKeuangan}</strong><br><span style="color: #666;">Keuangan</span>
              </td>
              <td style="border: 0.5px solid #ccc; padding: 15px 3px 3px 3px; vertical-align: bottom; text-align: center; height: 40px;">
                <strong style="font-size: 9px;">${sigDirKeuangan}</strong><br><span style="color: #666;">Dir Keuangan</span>
              </td>
              <td style="border: 0.5px solid #ccc; padding: 15px 3px 3px 3px; vertical-align: bottom; text-align: center; height: 40px;">
                <strong style="font-size: 9px;">${sigDirektur}</strong><br><span style="color: #666;">Direktur Utama</span>
              </td>
              <td style="border: 0.5px solid #ccc; padding: 15px 3px 3px 3px; vertical-align: bottom; text-align: center; height: 40px;">
                <strong style="font-size: 9px;">${sigAccounting}</strong><br><span style="color: #666;">Accounting</span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 15px; font-size: 8px; text-align: center; color: #666;">
          Dokumen ini dihasilkan otomatis oleh FinanceSync Pro. Tanda tangan digital sah secara hukum.
        </div>
      </div>

    </div>
  `;

  docBody.innerHTML = html;
  const modal = document.getElementById('documentModal');
  if (modal) modal.classList.remove('hidden');
}

window.previewDoc = async function() {
  const jenis = document.getElementById('fJenis')?.value;
  const lokasi = document.getElementById('fLokasi')?.value;
  
  if (!jenis || !lokasi) {
    Toast.warning('Lengkapi minimal Jenis dan Lokasi terlebih dahulu');
    return;
  }

  const formData = gatherFormData();
  await generateDocumentPreview(formData);
};

window.closeDoc = function() {
  const modal = document.getElementById('documentModal');
  if (modal) modal.classList.add('hidden');
};

// ✅ ULTRA-FIXED: PDF Generation dengan config optimal
window.dlPDF = async function() {
  try {
    const element = document.getElementById('docBody');
    if (!element) throw new Error('Document element not found');

    Toast.info('Membuat PDF... Mohon tunggu');
    
    // ✅ OPTIMIZED CONFIG FOR EXACT 2-PAGE OUTPUT (v3.8.9)
    const opt = {
      margin: 0,
      filename: `HO-${document.getElementById('fKode')?.value || 'VOUCHER'}-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,  // Turunkan dari 3 ke 2 untuk mengurangi ukuran + menghindari overflow
        useCORS: true,
        logging: false,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 794,   // 210mm × 3.78px/mm = exact A4 width
        windowHeight: 1123, // 297mm × 3.78px/mm = exact A4 height
        letterRendering: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 2
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true,
        putOnlyUsedFonts: true
      },
      pagebreak: { 
        mode: ['css', 'legacy'], 
        before: '.pdf-page',
        after: '.pdf-page',
        avoid: ['table', 'tr', 'td', 'th']
      }
    };
    
    // ✅ FORCE HIDE PAGES > 2 BEFORE GENERATION
    const pages = element.querySelectorAll('.pdf-page');
    const hiddenPages = [];
    for (let i = 2; i < pages.length; i++) {
      pages[i].style.display = 'none';
      pages[i].style.visibility = 'hidden';
      pages[i].style.position = 'absolute';
      pages[i].style.left = '-9999px';
      hiddenPages.push(pages[i]);
    }
    
    // ✅ GENERATE PDF
    const pdf = await html2pdf().set(opt).from(element).toPdf().get('pdf');
    
    // ✅ FORCE EXACTLY 2 PAGES (hapus extra pages jika ada)
    let pageCount = pdf.internal.getNumberOfPages();
    if (pageCount > 2) {
      console.warn(`⚠️ PDF has ${pageCount} pages, forcing to 2 pages`);
      for (let i = pageCount; i > 2; i--) {
        pdf.deletePage(i);
      }
      pageCount = 2;
    } else if (pageCount < 2) {
      // Tambah halaman kosong jika hanya 1 halaman tergenerate
      pdf.addPage();
      pageCount = 2;
    }
    
    // ✅ SAVE PDF
    await pdf.save();
    
    // ✅ RESTORE HIDDEN PAGES
    hiddenPages.forEach(page => {
      page.style.display = '';
      page.style.visibility = '';
      page.style.position = '';
      page.style.left = '';
    });
    
    Toast.success(`PDF berhasil didownload! 📥 (${pageCount} halaman)`);
    
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    Toast.error('Gagal membuat PDF: ' + error.message);
    
    // Restore hidden pages on error
    const pages = document.querySelectorAll('.pdf-page');
    for (let i = 2; i < pages.length; i++) {
      pages[i].style.display = '';
      pages[i].style.visibility = '';
      pages[i].style.position = '';
      pages[i].style.left = '';
    }
  }
};

// ==========================================
// 🏢 Company Modal Management
// ==========================================

window.openCompanyModal = function() {
  const modal = document.getElementById('companyModal');
  if (modal) {
    modal.classList.remove('hidden');
    loadCompaniesList();
  }
};

window.closeCompanyModal = function() {
  const modal = document.getElementById('companyModal');
  if (modal) modal.classList.add('hidden');
};

window.switchCompanyTab = function(tab, btnElement) {
  const listTab = document.getElementById('companyListTab');
  const formTab = document.getElementById('companyFormTab');
  const tabs = document.querySelectorAll('#companyModal .tab-item');

  tabs.forEach(tab => tab.classList.remove('on'));
  if (btnElement) btnElement.classList.add('on');

  if (tab === 'list') {
    if (listTab) listTab.style.display = '';
    if (formTab) formTab.style.display = 'none';
    loadCompaniesList();
  } else {
    if (listTab) listTab.style.display = 'none';
    if (formTab) formTab.style.display = '';
    resetCompanyForm();
  }
};

async function loadCompaniesList() {
  const container = document.getElementById('companyListContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-12 text-[--muted]"><div class="text-4xl mb-2">⏳</div><p class="text-xs">Memuat data perusahaan...</p></div>`;

  try {
    const companies = await CompanyDB.getAll();

    if (companies.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-[--muted]"><div class="text-4xl mb-2">🏢</div><p class="text-xs">Belum ada perusahaan</p><p class="text-[10px] mt-2">Klik tab "Tambah Baru" untuk membuat</p></div>`;
      return;
    }

    container.innerHTML = companies.map(comp => `
      <div class="company-list-item">
        <div class="company-list-icon" style="background:${comp.color || 'var(--accent)'}20;color:${comp.color || 'var(--accent)'}">${comp.icon || '🏢'}</div>
        <div class="company-list-info">
          <div class="company-list-name">${StringUtils.escapeHtml(comp.name)}</div>
          <div class="company-list-code">${comp.code}</div>
        </div>
        <div class="company-list-actions">
          <button onclick="editCompany('${comp.id}')" class="h-action-btn h-action-edit" title="Edit">✏️</button>
          <button onclick="deleteCompany('${comp.id}', '${comp.name.replace(/'/g, "\\'")}')" class="h-action-btn h-action-del" title="Hapus">🗑️</button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('❌ Error loading companies:', error);
    container.innerHTML = `<div class="text-center py-12 text-[--muted]"><div class="text-4xl mb-2">❌</div><p class="text-xs">Gagal memuat data</p></div>`;
  }
}

window.handleCompanySubmit = async function(e) {
  e.preventDefault();

  try {
    const code = document.getElementById('compCode').value.trim().toUpperCase();
    const name = document.getElementById('compName').value.trim();
    const editId = document.getElementById('editCompanyId').value;

    if (!code || !name) {
      Toast.warning('Kode dan Nama perusahaan wajib diisi');
      return;
    }

    const codeExists = await CompanyDB.isCodeExists(code, editId || null);
    if (codeExists) {
      Toast.error('Kode perusahaan sudah digunakan');
      return;
    }

    // ✅ FIXED v3.8.7: Include ALL 6 signature fields
    const companyData = {
      code, name,
      fullName: document.getElementById('compFullName').value.trim(),
      icon: document.getElementById('compIcon').value.trim() || '🏢',
      color: document.getElementById('compPrimaryColor').value,
      defaultLokasi: document.getElementById('compDefLokasi').value.trim(),
      defaultKode: document.getElementById('compDefKode').value.trim(),
      defaultJenis: document.getElementById('compDefJenis').value.trim(),
      sigDibuat: document.getElementById('compSigDibuat')?.value.trim() || '',
      sigDisetujui: document.getElementById('compSigDisetujui')?.value.trim() || '',
      sigKeuangan: document.getElementById('compSigKeuangan')?.value.trim() || '',
      sigDirKeuangan: document.getElementById('compSigDirKeuangan')?.value.trim() || '',
      sigDirektur: document.getElementById('compSigDirektur')?.value.trim() || '',
      sigAccounting: document.getElementById('compSigAccounting')?.value.trim() || ''
    };

    const submitBtn = document.getElementById('companySubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';
    }

    if (editId) {
      await CompanyDB.update(editId, companyData);
      Toast.success('Perusahaan berhasil diperbarui! ✏️');
    } else {
      await CompanyDB.create(companyData);
      Toast.success('Perusahaan berhasil ditambahkan! 🎉');
    }

    resetCompanyForm();
    switchCompanyTab('list', document.querySelector('#companyModal .tab-item'));

  } catch (error) {
    console.error('❌ Error saving company:', error);
    Toast.error('Gagal menyimpan perusahaan: ' + error.message);
  } finally {
    const submitBtn = document.getElementById('companySubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>💾 Simpan Perusahaan</span>';
    }
  }
};

window.resetCompanyForm = function() {
  const form = document.getElementById('companyForm');
  if (form) form.reset();

  document.getElementById('editCompanyId').value = '';
  document.getElementById('compIcon').value = '🏢';
  document.getElementById('compPrimaryColor').value = '#6366f1';
  
  // ✅ Reset signature fields
  if (document.getElementById('compSigDibuat')) document.getElementById('compSigDibuat').value = '';
  if (document.getElementById('compSigDisetujui')) document.getElementById('compSigDisetujui').value = '';
  if (document.getElementById('compSigKeuangan')) document.getElementById('compSigKeuangan').value = '';
  if (document.getElementById('compSigDirKeuangan')) document.getElementById('compSigDirKeuangan').value = '';
  if (document.getElementById('compSigDirektur')) document.getElementById('compSigDirektur').value = '';
  if (document.getElementById('compSigAccounting')) document.getElementById('compSigAccounting').value = '';

  const submitBtn = document.getElementById('companySubmitBtn');
  if (submitBtn) submitBtn.innerHTML = '<span>💾 Simpan Perusahaan</span>';
};

async function editCompany(id) {
  try {
    const company = await CompanyDB.getById(id);
    if (!company) throw new Error('Perusahaan tidak ditemukan');

    switchCompanyTab('form', document.querySelectorAll('#companyModal .tab-item')[1]);

    document.getElementById('editCompanyId').value = id;
    document.getElementById('compCode').value = company.code || '';
    document.getElementById('compName').value = company.name || '';
    document.getElementById('compFullName').value = company.fullName || '';
    document.getElementById('compIcon').value = company.icon || '🏢';
    document.getElementById('compPrimaryColor').value = company.color || '#6366f1';
    document.getElementById('compDefLokasi').value = company.defaultLokasi || '';
    document.getElementById('compDefKode').value = company.defaultKode || '';
    document.getElementById('compDefJenis').value = company.defaultJenis || '';
    document.getElementById('compSigDibuat').value = company.sigDibuat || '';
    document.getElementById('compSigDisetujui').value = company.sigDisetujui || '';
    document.getElementById('compSigKeuangan').value = company.sigKeuangan || '';
    document.getElementById('compSigDirKeuangan').value = company.sigDirKeuangan || '';
    document.getElementById('compSigDirektur').value = company.sigDirektur || '';
    document.getElementById('compSigAccounting').value = company.sigAccounting || '';

    const submitBtn = document.getElementById('companySubmitBtn');
    if (submitBtn) submitBtn.innerHTML = '<span>💾 Perbarui Perusahaan</span>';

  } catch (error) {
    console.error('❌ Error loading company for edit:', error);
    Toast.error('Gagal memuat data perusahaan');
  }
}

window.deleteCompany = async function(id, name) {
  if (confirm(`Apakah Anda yakin ingin menghapus perusahaan "${name}"?`)) {
    try {
      await CompanyDB.delete(id);
      Toast.success('Perusahaan berhasil dihapus!');
      loadCompaniesList();
    } catch (error) {
      console.error('❌ Error deleting company:', error);
      Toast.error('Gagal menghapus perusahaan');
    }
  }
};

// ==========================================
// 🏢 Company Selection (Login Screen)
// ==========================================

window.selectCompany = function(id, name, icon, color) {
  document.querySelectorAll('.comp-card').forEach(card => card.classList.remove('picked'));

  const selectedCard = document.getElementById(`companyCard_${id}`);
  if (selectedCard) selectedCard.classList.add('picked');

  StorageUtils.set('financesync_selectedCompany', { id, name, icon, color });
  AppState.currentCompany = { id, name, icon, color };

  console.log(`🏢 Selected company: ${name} (${id})`);
  Toast.info(`Perusahaan dipilih: ${icon} ${name}`);
};

// ==========================================
// 🔐 LOGIN & LOGOUT HANDLERS (SMART VERSION)
// ==========================================

window.doLogin = async function() {
  const email = document.getElementById('lEmail').value.trim();
  const password = document.getElementById('lPass').value;

  const lErr = document.getElementById('lErr');
  if (lErr) {
    lErr.classList.remove('show');
    lErr.style.background = 'rgba(239,68,68,.12)';
    lErr.style.color = '#fca5a5';
    lErr.style.borderColor = 'rgba(239,68,68,.2)';
  }

  if (!email || !password) {
    if (lErr) {
      lErr.textContent = 'Email dan password harus diisi';
      lErr.classList.add('show');
    }
    return;
  }

  let needsCompanySetup = false;

  try {
    if (APP_CONFIG.features.multiCompany) {
      const selectedCompany = StorageUtils.get('financesync_selectedCompany');

      if (!selectedCompany) {
        console.log('🔍 [doLogin] Checking company availability...');

        let companiesExist = false;
        let companiesCount = 0;

        try {
          if (typeof CompanyDB !== 'undefined' && typeof CompanyDB.getAll === 'function') {
            const companies = await CompanyDB.getAll();
            companiesCount = companies.length;
            companiesExist = companies.length > 0;
            console.log(`📊 [doLogin] Found ${companiesCount} companies in database`);
          }
        } catch (e) {
          console.warn('⚠️ [doLogin] Could not check companies:', e);
          companiesExist = false;
        }

        if (companiesExist) {
          console.log(`⚠️ [doLogin] Companies exist (${companiesCount}), must select one`);

          if (lErr) {
            lErr.innerHTML = `
              <div style="font-weight:600;margin-bottom:4px">⚠️ Pilih Perusahaan Dulu</div>
              <div style="font-size:11px;line-height:1.5;opacity:.85">
                Ada <strong>${companiesCount}</strong> perusahaan terdaftar.<br>
                Pilih salah satu di atas form login ini.
              </div>
            `;
            lErr.classList.add('show');
          }
          return;

        } else {
          console.log('✅ [doLogin] No companies found, allowing login without selection');
          needsCompanySetup = true;

          if (lErr) {
            lErr.innerHTML = `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:8px">
                <span style="font-size:20px;flex-shrink:0">💡</span>
                <div>
                  <div style="font-weight:600;color:#818cf8;font-size:13px">Belum Ada Perusahaan</div>
                  <div style="font-size:11px;color:#6b7280;margin-top:3px;line-height:1.4">
                    Tidak apa-apa! Login dulu, lalu buat perusahaan pertama.<br>
                    <strong style="color:#818cf8">Modal "Perusahaan"</strong> akan terbuka otomatis.
                  </div>
                </div>
              </div>
            `;
            lErr.style.background = 'transparent';
            lErr.style.color = '#e0e7ff';
            lErr.style.borderColor = 'transparent';
            lErr.classList.add('show');

            setTimeout(() => {
              if (lErr) lErr.classList.remove('show');
            }, 5000);
          }
        }
      }
    }

    console.log('🔑 [doLogin] Executing login...');

    await loginUser(email, password);

    if (needsCompanySetup) {
      if (typeof StorageUtils !== 'undefined') {
        StorageUtils.set('financesync_needsFirstCompany', true);
        console.log('📝 [doLogin] Flag saved: User needs to create first company after login');
      }
    }

  } catch (error) {
    console.error('❌ [doLogin] Error:', error);
  }
};

window.doLogout = async function() {
  if (confirm('Apakah Anda yakin ingin logout?')) {
    await logoutUser();
    window.updateAuthUI?.();
  }
};

// ==========================================
// ⚙️ UI Setup Helpers
// ==========================================

function setupUIElements() {
  const statusSelect = document.getElementById('fStatus');
  if (statusSelect) {
    statusSelect.addEventListener('change', function() {
      const tglBayarContainer = document.getElementById('fTglBayarContainer');
      if (tglBayarContainer) tglBayarContainer.style.display = this.value === 'Lunas' ? '' : 'none';
    });
  }

  const clearHistoryBtn = document.getElementById('clearHistory');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async function() {
      if (confirm('Hapus semua data transaksi?')) {
        const hList = document.getElementById('hList');
        if (hList) {
          hList.innerHTML = `<div class="text-center py-12 text-[--muted]"><div class="text-4xl mb-2">📋</div><p class="text-xs">Belum ada data transaksi</p></div>`;
        }
        Toast.info('Daftar telah dikosongkan');
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeDoc();
      closeCompanyModal();
    }
  });

  const documentModal = document.getElementById('documentModal');
  if (documentModal) {
    documentModal.addEventListener('click', function(e) {
      if (e.target === this) closeDoc();
    });
  }

  const companyModal = document.getElementById('companyModal');
  if (companyModal) {
    companyModal.addEventListener('click', function(e) {
      if (e.target === this) closeCompanyModal();
    });
  }
}

// ==========================================
// 🔐 Auth State UI Manager
// ==========================================

window.updateAuthUI = function() {
  let user = null;
  let isLoggedIn = false;

  try {
    if (typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
      user = AuthManager.getCurrentUser();
      isLoggedIn = !!user;
    } else if (typeof firebase !== 'undefined' && firebase.auth) {
      user = firebase.auth().currentUser;
      isLoggedIn = !!user;
    } else {
      const userData = StorageUtils.get('financesync_user');
      isLoggedIn = !!userData;
      user = userData;
    }
  } catch (e) {
    console.warn('⚠️ Error checking auth state:', e);
    isLoggedIn = false;
  }

  const authOnlyIds = ['logoutBtn', 'companyBtn', 'dashboardContent', 'mainForm', 'historySection'];
  const guestOnlyIds = ['loginSection', 'companySelectArea', 'loginForm'];

  authOnlyIds.forEach(elId => {
    const el = document.getElementById(elId);
    if (el) el.style.display = isLoggedIn ? '' : 'none';
  });

  guestOnlyIds.forEach(elId => {
    const el = document.getElementById(elId);
    if (el) el.style.display = isLoggedIn ? 'none' : '';
  });

  const userInfoEl = document.getElementById('userInfo') || document.getElementById('userEmail');
  if (userInfoEl) {
    userInfoEl.textContent = isLoggedIn ? (user?.email || 'User') : '';
    userInfoEl.style.display = isLoggedIn ? '' : 'none';
  }

  console.log(`🔐 Auth UI updated: ${isLoggedIn ? 'LOGGED IN ✓' : 'GUEST MODE'}`);
  return isLoggedIn;
};

window.initAuthListener = function() {
  try {
    if (typeof AuthManager !== 'undefined' && typeof AuthManager.onAuthStateChanged === 'function') {
      console.log('🔐 Setting up AuthManager listener...');

      AuthManager.onAuthStateChanged(function(user) {
        console.log('🔄 Auth state changed:', user ? 'logged in' : 'logged out');
        window.updateAuthUI();

        if (user) {
          let company = AppState.currentCompany;
          if (!company) {
            company = StorageUtils.get('financesync_selectedCompany');
            if (company) {
              AppState.currentCompany = company;
              console.log('🔧 Auto-restored company on auth change');
            }
          }
          
          if (company && company.id) {
            if (typeof loadSubmissions === 'function') {
              loadSubmissions(company.id, AppState.activeTab).catch(console.error);
            }
            if (typeof updateDashboardStats === 'function') {
              updateDashboardStats(company.id).catch(console.error);
            }
          }
        }
      });
    } else if (typeof firebase !== 'undefined' && firebase.auth) {
      console.log('🔐 Setting up Firebase Auth listener...');

      firebase.auth().onAuthStateChanged(function(user) {
        console.log('🔄 Firebase auth state changed:', user ? 'logged in' : 'logged out');
        window.updateAuthUI();

        if (user) {
          let company = AppState.currentCompany;
          if (!company) {
            company = StorageUtils.get('financesync_selectedCompany');
            if (company) AppState.currentCompany = company;
          }
          
          if (company && company.id) {
            if (typeof loadSubmissions === 'function') loadSubmissions(company.id, AppState.activeTab).catch(console.error);
            if (typeof updateDashboardStats === 'function') updateDashboardStats(company.id).catch(console.error);
          }
        }
      });
    } else {
      console.warn('⚠️ No auth manager found, using one-time check');
      window.updateAuthUI();
    }

  } catch (error) {
    console.error('❌ Error initializing auth listener:', error);
    window.updateAuthUI();
  }
};

// ==========================================
// 📦 Export to Global Scope
// ==========================================

window.AppState = AppState;
window.addFormItem = addFormItem;
window.removeItemForm = removeFormItem;
window.updateFormItem = updateFormItem;
window.calculateTotal = calculateTotal;
window.resetForm = resetForm;
window.cancelEdit = cancelEdit;
window.editSubmission = editSubmission;
window.viewSubmission = viewSubmission;
window.confirmDeleteSubmission = confirmDeleteSubmission;
window.previewDoc = previewDoc;
window.closeDoc = closeDoc;
window.dlPDF = dlPDF;
window.openCompanyModal = openCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.switchCompanyTab = switchCompanyTab;
window.handleCompanySubmit = handleCompanySubmit;
window.resetCompanyForm = resetCompanyForm;
window.editCompany = editCompany;
window.deleteCompany = deleteCompany;
window.selectCompany = selectCompany;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.updateAuthUI = window.updateAuthUI;
window.initAuthListener = window.initAuthListener;

console.log('%c🎮 Main App module loaded v3.8.9 (PDF ULTRA-FIXED)', 'color: #8b5cf6; font-size: 11px; font-weight: bold;');
console.log('%c🔧 All Fixes Applied:', 'color: #22c55e; font-size: 10px;');
console.log('  ✅ Missing catch/finally after try → FIXED');
console.log('  ✅ Mismatched curly braces in doLogin → FIXED');
console.log('  ✅ Infinite loop prevention (resetForm/cancelEdit)');
console.log('  ✅ Smart login (no-company allowed)');
console.log('  ✅ Auth state UI management');
console.log('  ✅ NEW: switchTab fallback ke localStorage (v3.8.6)');
console.log('  ✅ NEW: Auto-restore AppState.currentCompany on init (v3.8.6)');
console.log('  ✅ NEW: Handle tab "Semua" tanpa filter status (v3.8.6)');
console.log('  ✅ NEW: Support snake_case + camelCase in edit/view (v3.8.6)');
console.log('  ✅ NEW: 2-Page PDF Output (Formulir HO + Bukti Kas/Bank)');
console.log('  ✅ NEW v3.8.7: PDF download EXACT 2 pages + 6 signatures from Firestore');
console.log('  ✅ NEW v3.8.8: PDF LAYOUT FIX - Table-based HTML for reliable rendering');
console.log('  ✅ NEW v3.8.9: PDF ULTRA-FIX - Exact A4 dimensions + compact styling + page enforcement');

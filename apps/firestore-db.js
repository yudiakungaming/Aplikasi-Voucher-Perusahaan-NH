/**
 * ============================================
 * FinanceSync Pro v3.8.1 - Firestore Database Operations (FIXED & OPTIMIZED)
 * ============================================
 * 
 * 📅 Diperbaiki: 11/05/2026 - v3.8.6
 * 🔧 Fix:
 *   • Field name consistency (company_id with underscore)
 *   • Auto-inject company_id saat create submission
 *   • ✅ SUPPORT DUAL FIELD NAMES: Support data migrasi (snake_case) + data baru (camelCase)
 *   • ✅ orderBy fallback: Try createdAt first, fallback to created_at
 *   • ✅ CRITICAL: Company Document ID = company code (bukan auto-generated)
 */

// ==========================================
// 📊 Submissions Collection Operations
// ==========================================

const SubmissionDB = {
  getCollectionRef(companyId = null) {
    if (typeof firebaseDb === 'undefined' || !firebaseDb) {
      throw new Error('Firestore not initialized. Make sure Firebase is connected.');
    }
    
    if (typeof APP_CONFIG === 'undefined') {
      throw new Error('APP_CONFIG not found.');
    }

    const collectionRef = firebaseDb.collection(APP_CONFIG.firestore.submissionsCollection);
    
    if (companyId) {
      return collectionRef.where('company_id', '==', companyId);
    }
    
    return collectionRef;
  },

  async create(submissionData) {
    try {
      if (typeof firebaseDb === 'undefined') {
        throw new Error('Firebase Firestore tidak tersedia');
      }

      const selectedCompany = typeof StorageUtils !== 'undefined' 
        ? StorageUtils.get('financesync_selectedCompany') 
        : null;
      
      const activeCompanyId = selectedCompany?.id 
        || (typeof AppState !== 'undefined' ? AppState.currentCompany?.id : null)
        || null;
      
      const activeCompanyName = selectedCompany?.name 
        || (typeof AppState !== 'undefined' ? AppState.currentCompany?.name : null)
        || null;

      const data = {
        ...submissionData,
        
        // 🔥 CRITICAL: company_id dengan underscore agar query bisa menemukan data
        company_id: submissionData.company_id || submissionData.companyId || activeCompanyId,
        company_name: submissionData.company_name || submissionData.companyName || activeCompanyName,
        
        // Keep backward compatibility
        companyId: submissionData.company_id || submissionData.companyId || activeCompanyId,
        companyName: submissionData.company_name || submissionData.companyName || activeCompanyName,
        
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: (typeof firebaseAuth !== 'undefined' && firebaseAuth?.currentUser)?.uid || null,
        createdByEmail: (typeof firebaseAuth !== 'undefined' && firebaseAuth?.currentUser)?.email || null
      };

      const docRef = await this.getCollectionRef().add(data);
      
      console.log(`✅ Submission created: ${docRef.id}`, { company_id: data.company_id });
      
      if (typeof Toast !== 'undefined') {
        Toast.success('Transaksi berhasil disimpan!');
      }
      
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Error creating submission:', error);
      
      if (typeof Toast !== 'undefined') {
        Toast.error('Gagal menyimpan transaksi: ' + error.message);
      }
      
      throw error;
    }
  },

  async update(docId, updateData) {
    try {
      const data = {
        ...updateData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      if (updateData.companyId !== undefined && updateData.company_id === undefined) {
        data.company_id = updateData.companyId;
      }
      if (updateData.companyName !== undefined && updateData.company_name === undefined) {
        data.company_name = updateData.companyName;
      }

      await this.getCollectionRef().doc(docId).update(data);
      console.log(`✅ Submission updated: ${docId}`);
      
    } catch (error) {
      console.error(`❌ Error updating submission ${docId}:`, error);
      throw error;
    }
  },

  async delete(docId) {
    try {
      await this.getCollectionRef().doc(docId).delete();
      console.log(`✅ Submission deleted: ${docId}`);
    } catch (error) {
      console.error(`❌ Error deleting submission ${docId}:`, error);
      throw error;
    }
  },

  async getById(docId) {
    try {
      const docSnap = await this.getCollectionRef().doc(docId).get();
      
      if (docSnap.exists) {
        return this._normalizeData(docSnap.id, docSnap.data());
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting submission ${docId}:`, error);
      throw error;
    }
  },

  /**
   * ✅ NEW: Normalize data to support both snake_case (migrated) and camelCase (new)
   * @private
   */
  _normalizeData(id, data) {
    return {
      id: id,
      ...data,
      // Ensure camelCase fields exist for UI consistency
      createdAt: data.createdAt || data.created_at,
      created_at: data.created_at || data.createdAt,  // Keep both for flexibility
      totalNominal: data.totalNominal || data.total_nominal,
      total_nominal: data.total_nominal || data.totalNominal,
      companyName: data.companyName || data.company_name,
      company_name: data.company_name || data.companyName,
      jenisPengajuan: data.jenisPengajuan || data.jenis_pengajuan,
      jenis_pengajuan: data.jenis_pengajuan || data.jenisPengajuan,
      noInvoice: data.noInvoice || data.no_invoice,
      no_invoice: data.no_invoice || data.noInvoice,
      dibayarkanKepada: data.dibayarkanKepada || data.dibayarkan_kepada,
      dibayarkan_kepada: data.dibayarkan_kepada || data.dibayarkanKepada,
      catatanTambahan: data.catatanTambahan || data.catatan_tambahan,
      catatan_tambahan: data.catatan_tambahan || data.catatanTambahan
    };
  },

  /**
   * ✅ IMPROVED: Handle dual field names for orderBy and data access
   */
  async getAll(filters = {}) {
    try {
      let query = this.getCollectionRef(filters.companyId);

      // Apply status filter
      if (filters.status && filters.status !== 'Semua') {
        query = query.where('status', '==', filters.status);
      }

      // ✅ TRY camelCase orderBy first (new data), fallback to snake_case (migrated data)
      let orderByField = filters.orderBy || 'createdAt';
      const orderDir = filters.orderDirection === 'asc' ? 'asc' : 'desc';
      
      try {
        query = query.orderBy(orderByField, orderDir);
      } catch (orderError) {
        // If camelCase fails, try snake_case
        console.warn(`⚠️ orderBy '${orderByField}' failed, trying snake_case fallback...`);
        const snakeCaseMap = {
          'createdAt': 'created_at',
          'updatedAt': 'updated_at',
          'totalNominal': 'total_nominal'
        };
        const fallbackField = snakeCaseMap[orderByField] || orderByField;
        query = query.orderBy(fallbackField, orderDir);
      }

      // Apply limit
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const snapshot = await query.get();
      
      const submissions = [];
      snapshot.forEach(doc => {
        // ✅ Normalize data to support both field naming conventions
        submissions.push(this._normalizeData(doc.id, doc.data()));
      });

      console.log(`📊 Loaded ${submissions.length} submissions`, { 
        company_id: filters.companyId, 
        status: filters.status 
      });
      return submissions;

    } catch (error) {
      console.error('❌ Error getting submissions:', error);
      
      // ✅ Handle "requires index" error with fallback option
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.warn('⚠️ Composite index required. Try fallback query...');
        
        try {
          console.log('🔄 Using fallback query (no status filter, no orderBy)');
          let fallbackQuery = this.getCollectionRef(filters.companyId);
          if (filters.limit) fallbackQuery = fallbackQuery.limit(filters.limit);
          
          const snapshot = await fallbackQuery.get();
          const submissions = [];
          snapshot.forEach(doc => {
            submissions.push(this._normalizeData(doc.id, doc.data()));
          });
          
          console.log(`📊 Fallback: Loaded ${submissions.length} submissions`);
          if (typeof Toast !== 'undefined') {
            Toast.info('Menampilkan data dengan format yang disesuaikan');
          }
          return submissions;
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
        }
        
        if (typeof Toast !== 'undefined') {
          Toast.warning('Mengoptimalkan query... silakan tunggu beberapa saat.');
        }
      }
      
      throw error;
    }
  },

  subscribe(filters = {}, onChange) {
    let query = this.getCollectionRef(filters.companyId);

    if (filters.status && filters.status !== 'Semua') {
      query = query.where('status', '==', filters.status);
    }

    // ✅ Same orderBy fallback logic for real-time listener
    let orderByField = filters.orderBy || 'createdAt';
    const orderDir = filters.orderDirection === 'asc' ? 'asc' : 'desc';
    
    try {
      query = query.orderBy(orderByField, orderDir);
    } catch (orderError) {
      console.warn(`⚠️ orderBy '${orderByField}' failed in subscribe, trying snake_case...`);
      const snakeCaseMap = {
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
        'totalNominal': 'total_nominal'
      };
      const fallbackField = snakeCaseMap[orderByField] || orderByField;
      query = query.orderBy(fallbackField, orderDir);
    }

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const submissions = [];
        snapshot.forEach(doc => {
          submissions.push(this._normalizeData(doc.id, doc.data()));
        });

        if (typeof onChange === 'function') {
          onChange(submissions);
        }
      },
      (error) => {
        console.error('❌ Subscription error:', error);
        
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
          console.warn('⚠️ Real-time subscription requires index.');
        }
        
        if (typeof Toast !== 'undefined') {
          Toast.error('Gagal memuat data real-time');
        }
      }
    );

    console.log('👂 Listening for submission changes...', { 
      company_id: filters.companyId,
      status: filters.status 
    });
    return unsubscribe;
  },

  async getStats(companyId = null) {
    try {
      const allSubmissions = await this.getAll({ companyId });
      
      const stats = {
        total: allSubmissions.length,
        lunas: allSubmissions.filter(s => s.status === 'Lunas').length,
        belumLunas: allSubmissions.filter(s => s.status === 'Belum Lunas').length,
        withFiles: allSubmissions.filter(s => s.files && s.files.length > 0).length,
        // ✅ Support both field names for total_nominal
        totalNominal: allSubmissions.reduce((sum, s) => {
          const nominal = s.total_nominal || s.totalNominal || 0;
          return sum + (parseFloat(nominal) || 0);
        }, 0)
      };

      console.log('📈 Stats:', stats, { company_id: companyId });
      return stats;

    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { total: 0, lunas: 0, belumLunas: 0, withFiles: 0, totalNominal: 0 };
    }
  },

  async search(searchTerm, companyId = null) {
    try {
      const allSubmissions = await this.getAll({ companyId });
      
      if (!searchTerm) return allSubmissions;
      
      const term = searchTerm.toLowerCase();
      // ✅ Search both snake_case and camelCase field names
      const searchFields = [
        'lokasi', 'jenis_pengajuan', 'jenisPengajuan', 'kode', 
        'no_invoice', 'noInvoice', 'dibayarkan_kepada', 'dibayarkanKepada', 
        'catatan_tambahan', 'catatanTambahan'
      ];
      
      return allSubmissions.filter(submission =>
        searchFields.some(field => {
          const value = submission[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );

    } catch (error) {
      console.error('❌ Error searching submissions:', error);
      throw error;
    }
  },

  async batchDelete(docIds) {
    try {
      const batch = firebaseDb.batch();
      
      docIds.forEach(docId => {
        const docRef = this.getCollectionRef().doc(docId);
        batch.delete(docRef);
      });

      await batch.commit();
      console.log(`✅ Batch deleted ${docIds.length} submissions`);
      
    } catch (error) {
      console.error('❌ Error in batch delete:', error);
      throw error;
    }
  }
};

// ==========================================
// 🏢 Companies Collection Operations
// ==========================================

const CompanyDB = {
  getCollectionRef() {
    if (typeof firebaseDb === 'undefined' || !firebaseDb) {
      throw new Error('Firestore not initialized');
    }
    
    if (typeof APP_CONFIG === 'undefined') {
      throw new Error('APP_CONFIG not found');
    }
    
    return firebaseDb.collection(APP_CONFIG.firestore.companiesCollection);
  },

  /**
   * 🔧 FIXED v3.8.6: Use company code as Document ID (not auto-generated)
   * Document ID will match the code you enter in the app (e.g., "NMSA", "PTCONTOH")
   */
  async create(companyData) {
    try {
      const data = {
        ...companyData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: (typeof firebaseAuth !== 'undefined' && firebaseAuth?.currentUser)?.uid || null
      };

      // 🔧 Generate Document ID from company code (or name fallback)
      // Firestore Document ID rules: alphanumeric, underscore, dash, max 1500 chars
      let companyId = '';
      
      if (data.code && data.code.trim()) {
        // Use code if provided: uppercase, alphanumeric + underscore only
        companyId = data.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      } else if (data.name && data.name.trim()) {
        // Fallback: generate from name
        companyId = data.name.trim()
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, '')  // Remove special chars
          .replace(/\s+/g, '_')          // Replace spaces with underscore
          .substring(0, 50);             // Max 50 chars for ID
      }
      
      // Ensure we have a valid ID
      if (!companyId || companyId.length < 2) {
        throw new Error('Company code atau name harus diisi (minimal 2 karakter)');
      }
      
      // Remove leading/trailing underscores
      companyId = companyId.replace(/^_+|_+$/g, '');
      
      if (!companyId) {
        throw new Error('Company code tidak valid setelah sanitasi');
      }

      // 🔧 Check if document ID already exists
      const existingDoc = await this.getCollectionRef().doc(companyId).get();
      if (existingDoc.exists) {
        throw new Error(`Company code "${data.code || companyId}" sudah digunakan. Silakan gunakan code yang berbeda.`);
      }

      // 🔧 Save with custom Document ID (not auto-generated)
      const docRef = this.getCollectionRef().doc(companyId);
      await docRef.set(data);
      
      console.log(`✅ Company created with ID: ${companyId}`, { 
        name: data.name, 
        code: data.code 
      });
      
      if (typeof Toast !== 'undefined') {
        Toast.success(`Perusahaan "${data.name}" berhasil ditambahkan!`);
      }
      
      return companyId;
      
    } catch (error) {
      console.error('❌ Error creating company:', error);
      
      if (typeof Toast !== 'undefined') {
        if (error.message.includes('sudah digunakan')) {
          Toast.error(error.message);
        } else {
          Toast.error('Gagal menambahkan perusahaan: ' + error.message);
        }
      }
      
      throw error;
    }
  },

  async update(docId, updateData) {
    try {
      const data = {
        ...updateData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.getCollectionRef().doc(docId).update(data);
      console.log(`✅ Company updated: ${docId}`);
      
    } catch (error) {
      console.error(`❌ Error updating company ${docId}:`, error);
      throw error;
    }
  },

  async delete(docId) {
    try {
      await this.getCollectionRef().doc(docId).delete();
      console.log(`✅ Company deleted: ${docId}`);
    } catch (error) {
      console.error(`❌ Error deleting company ${docId}:`, error);
      throw error;
    }
  },

  async getById(docId) {
    try {
      const docSnap = await this.getCollectionRef().doc(docId).get();
      
      if (docSnap.exists) {
        return {
          id: docSnap.id,  // docId is now the company code!
          ...docSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting company ${docId}:`, error);
      throw error;
    }
  },

  async getAll() {
    try {
      const snapshot = await this.getCollectionRef().orderBy('name', 'asc').get();
      
      const companies = [];
      snapshot.forEach(doc => {
        companies.push({
          id: doc.id,  // doc.id is now the company code!
          ...doc.data()
        });
      });

      console.log(`🏢 Loaded ${companies.length} companies`);
      return companies;

    } catch (error) {
      console.error('❌ Error getting companies:', error);
      throw error;
    }
  },

  async getByCode(code) {
    try {
      // 🔧 Now we can query directly by document ID since ID = code
      const docSnap = await this.getCollectionRef().doc(code).get();
      
      if (docSnap.exists) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting company by code ${code}:`, error);
      throw error;
    }
  },

  async isCodeExists(code, excludeDocId = null) {
    try {
      // 🔧 Direct document check (faster than query)
      const docSnap = await this.getCollectionRef().doc(code).get();
      
      if (!docSnap.exists) return false;
      
      // If excluding a doc (edit mode), check if it's the same doc
      if (excludeDocId) {
        return docSnap.id !== excludeDocId;
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error checking company code:', error);
      return false;
    }
  },

  subscribe(onChange) {
    const unsubscribe = this.getCollectionRef()
      .orderBy('name', 'asc')
      .onSnapshot(
        (snapshot) => {
          const companies = [];
          snapshot.forEach(doc => {
            companies.push({
              id: doc.id,  // doc.id is now the company code!
              ...doc.data()
            });
          });

          if (typeof onChange === 'function') {
            onChange(companies);
          }
        },
        (error) => {
          console.error('❌ Company subscription error:', error);
        }
      );

    return unsubscribe;
  }
};

// ==========================================
// 🔧 Helper Functions (UI Rendering & Data Loading)
// ==========================================

if (typeof window.loadInitialData !== 'function') {
  window.loadInitialData = async function() {
    try {
      console.log('📦 [firestore-db] Loading initial data...');
      
      let selectedCompany = null;
      if (typeof StorageUtils !== 'undefined') {
        selectedCompany = StorageUtils.get('financesync_selectedCompany');
      }
      
      if (!selectedCompany && typeof AppState !== 'undefined' && AppState.currentCompany) {
        selectedCompany = AppState.currentCompany;
      }
      
      if (selectedCompany) {
        console.log(`📦 Loading data for company: ${selectedCompany.name}`);
        
        if (typeof loadSubmissions === 'function') {
          await loadSubmissions(selectedCompany.id, typeof AppState !== 'undefined' ? (AppState.activeTab || 'Lunas') : 'Lunas')
            .catch(err => console.warn('⚠️ Error loading submissions:', err));
        }
        
        if (typeof updateDashboardStats === 'function') {
          await updateDashboardStats(selectedCompany.id)
            .catch(err => console.warn('⚠️ Error updating stats:', err));
        }
      } else {
        console.log('ℹ️ No company selected, showing empty state');
        if (typeof showEmptyState === 'function') {
          showEmptyState();
        }
      }
      
    } catch (error) {
      console.error('❌ [firestore-db] Error loading initial data:', error);
      if (typeof Toast !== 'undefined') {
        Toast.error('Gagal memuat data awal');
      }
    }
  };
}

async function loadSubmissions(companyId, statusFilter = 'Lunas') {
  try {
    const hList = document.getElementById('hList');
    if (!hList) {
      console.warn('⚠️ Element #hList not found');
      return;
    }
    
    hList.innerHTML = `
      <div class="text-center py-12 text-[--muted]">
        <div class="text-4xl mb-2">⏳</div>
        <p class="text-xs">Memuat data...</p>
      </div>
    `;

    const submissions = await SubmissionDB.getAll({
      companyId: companyId,
      status: statusFilter,
      orderBy: 'createdAt',
      orderDirection: 'desc',
      limit: 50
    });

    renderSubmissionList(submissions);
    
  } catch (error) {
    console.error('❌ Error loading submissions:', error);
    
    const hList = document.getElementById('hList');
    if (hList) {
      if (error.message && error.message.includes('index')) {
        hList.innerHTML = `
          <div class="text-center py-12 text-[--muted]">
            <div class="text-4xl mb-2">⚙️</div>
            <p class="text-xs">Mengoptimalkan database...</p>
            <p class="text-[10px] opacity-70 mt-2">Silakan tunggu 1-2 menit lalu refresh</p>
            <button onclick="location.reload()"
                    style="margin-top:12px;padding:8px 20px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px">
              🔄 Refresh Sekarang
            </button>
          </div>
        `;
      } else {
        hList.innerHTML = `
          <div class="text-center py-12 text-[--muted]">
            <div class="text-4xl mb-2">❌</div>
            <p class="text-xs">Gagal memuat data</p>
            <button onclick="loadSubmissions('${companyId}', '${statusFilter}')"
                    style="margin-top:12px;padding:8px 20px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px">
              🔄 Coba Lagi
            </button>
          </div>
        `;
      }
    }
  }
}

function renderSubmissionList(submissions) {
  const hList = document.getElementById('hList');
  if (!hList) return;

  if (submissions.length === 0) {
    hList.innerHTML = `
      <div class="text-center py-12 text-[--muted]">
        <div class="text-4xl mb-2">📋</div>
        <p class="text-xs">Belum ada data transaksi</p>
      </div>
    `;
    return;
  }

  hList.innerHTML = submissions.map(sub => {
    // ✅ Support both snake_case and camelCase for display
    const status = sub.status || '-';
    const jenis = sub.jenis_pengajuan || sub.jenisPengajuan || sub.jenis || '-';
    const lokasi = sub.lokasi || '-';
    const tanggal = sub.tanggal || '-';
    const totalNominal = parseFloat(sub.total_nominal || sub.totalNominal) || 0;
    const id = sub.id || '';
    
    const statusColor = status === 'Lunas' ? '#22c55e' : '#f59e0b';
    const statusBg = status === 'Lunas' ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)';
    
    let formattedTotal = 'Rp 0';
    if (typeof CurrencyUtils !== 'undefined') {
      formattedTotal = CurrencyUtils.formatRupiah(totalNominal);
    }
    
    let formattedDate = tanggal;
    if (typeof DateUtils !== 'undefined') {
      formattedDate = DateUtils.formatDate(tanggal);
    }
    
    let safeJenis = jenis;
    let safeLokasi = lokasi;
    if (typeof StringUtils !== 'undefined') {
      safeJenis = StringUtils.escapeHtml(jenis);
      safeLokasi = StringUtils.escapeHtml(lokasi);
    }
    
    return `
      <div class="h-item" onclick="viewSubmission('${id}')" style="
        background:rgba(15,23,42,.4);
        border:1px solid var(--border, rgba(255,255,255,0.1));
        border-radius:10px;
        padding:14px;
        margin-bottom:10px;
        cursor:pointer;
        transition:all 0.2s;
      " onmouseover="this.style.borderColor='var(--accent,#6366f1)';this.style.background='rgba(15,23,42,.6)'" 
         onmouseout="this.style.borderColor='var(--border, rgba(255,255,255,0.1))';this.style.background='rgba(15,23,42,.4)'">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:600;font-size:13px;color:var(--fg,#e2e8f0)">${safeJenis}</span>
          <span style="font-size:10px;padding:3px 10px;border-radius:20px;background:${statusBg};color:${statusColor};font-weight:600">
            ${status}
          </span>
        </div>
        <div style="font-size:11px;color:var(--muted,#94a3b8);margin-bottom:6px">
          📍 ${safeLokasi} • 📅 ${formattedDate}
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--fg,#e2e8f0)">
          ${formattedTotal}
        </div>
        <div class="h-item-actions" style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border, rgba(255,255,255,0.05))">
          <button onclick="event.stopPropagation();editSubmission('${id}')" 
                  style="padding:6px 12px;background:rgba(99,102,241,.1);color:#818cf8;border:none;border-radius:6px;cursor:pointer;font-size:11px;flex:1">
            ✏️ Edit
          </button>
          <button onclick="event.stopPropagation();confirmDeleteSubmission('${id}')" 
                  style="padding:6px 12px;background:rgba(239,68,68,.1);color:#f87171;border:none;border-radius:6px;cursor:pointer;font-size:11px;flex:1">
            🗑️ Hapus
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function updateDashboardStats(companyId) {
  try {
    const stats = await SubmissionDB.getStats(companyId);
    
    const elements = {
      totalEl: document.getElementById('totalData'),
      lunasEl: document.getElementById('lunasData'),
      pendingEl: document.getElementById('pendingData'),
      filesEl: document.getElementById('sheetsData')
    };
    
    if (elements.totalEl) elements.totalEl.textContent = stats.total;
    if (elements.lunasEl) elements.lunasEl.textContent = stats.lunas;
    if (elements.pendingEl) elements.pendingEl.textContent = stats.belumLunas;
    if (elements.filesEl) elements.filesEl.textContent = stats.withFiles;
    
    console.log('📈 Dashboard stats updated:', stats);
    
  } catch (error) {
    console.error('❌ Error updating stats:', error);
  }
}

function showEmptyState() {
  const hList = document.getElementById('hList');
  if (hList) {
    hList.innerHTML = `
      <div class="text-center py-12 text-[--muted]" style="color:#94a3b8">
        <div class="text-4xl mb-3">🏢</div>
        <p class="text-sm font-medium mb-1">Belum ada data transaksi</p>
        <p class="text-xs opacity-70">Tambahkan transaksi pertama Anda</p>
      </div>
    `;
  }
}

if (typeof window.loadCompaniesForLogin !== 'function') {
  window.loadCompaniesForLogin = async function() {
    try {
      console.log('🏢 [firestore-db] Loading companies for login...');
      
      const grid = document.getElementById('loginCompanyGrid') ||
                   document.getElementById('companySelectArea') ||
                   document.getElementById('companyListLogin');
      
      if (!grid) {
        console.warn('⚠️ Company grid container not found in DOM');
        return;
      }
      
      grid.innerHTML = `
        <div style="text-align:center;padding:24px;color:#94a3b8;">
          <div style="width:32px;height:32px;border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>
          <p style="font-size:12px">Memuat daftar perusahaan...</p>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      `;

      const companies = await CompanyDB.getAll();

      if (companies.length === 0) {
        grid.innerHTML = `
          <div style="text-align:center;padding:24px;color:#94a3b8;">
            <div style="font-size:36px;margin-bottom:8px">🏢</div>
            <p style="font-size:13px font-weight:500">Belum ada perusahaan</p>
            <p style="font-size:11px;margin-top:4px;opacity:.7">Hubungi admin untuk menambahkan</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = companies.map(comp => {
        const name = comp.name || 'Unnamed Company';
        const code = comp.code || '';
        const icon = comp.icon || '🏢';
        const color = comp.color || '#6366f1';
        const id = comp.id;  // ✅ Now id = code!
        
        const safeName = typeof StringUtils !== 'undefined' ? StringUtils.escapeHtml(name) : name;
        
        return `
          <div class="comp-card" 
               id="companyCard_${id}" 
               onclick="selectCompany('${id}','${safeName.replace(/'/g, "\\'")}','${icon}','${color}')"
               style="
                 cursor:pointer;
                 padding:14px;
                 border-radius:10px;
                 border:1px solid rgba(255,255,255,0.08);
                 background:rgba(15,23,42,0.5);
                 margin-bottom:8px;
                 transition:all 0.2s ease;
                 display:flex;
                 align-items:center;
                 gap:12px;
               "
               onmouseover="this.style.borderColor='${color}40';this.style.transform='translateY(-1px)'"
               onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.transform='translateY(0)'"
          >
            <div style="
              width:44px;height:44px;
              border-radius:10px;
              background:${color}15;
              color:${color};
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:22px;
              flex-shrink:0;
            ">${icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${safeName}
              </div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">${code}</div>
            </div>
          </div>
        `;
      }).join('');

      if (typeof StorageUtils !== 'undefined') {
        const savedSelection = StorageUtils.get('financesync_selectedCompany');
        if (savedSelection && savedSelection.id) {
          const card = document.getElementById(`companyCard_${savedSelection.id}`);
          if (card) {
            card.classList.add('picked');
            card.style.borderColor = `${savedSelection.color || color}80`;
            card.style.background = `${(savedSelection.color || color)}10`;
          }
        }
      }

      console.log(`✅ [firestore-db] Loaded ${companies.length} companies`);

    } catch (error) {
      console.error('❌ [firestore-db] Error loading companies for login:', error);
      
      const grid = document.getElementById('loginCompanyGrid') ||
                   document.getElementById('companySelectArea');
      if (grid) {
        grid.innerHTML = `
          <div style="text-align:center;padding:24px;color:#ef4444;">
            <div style="font-size:36px;margin-bottom:8px">❌</div>
            <p style="font-size:13px font-weight:500">Gagal memuat perusahaan</p>
            <button onclick="window.loadCompaniesForLogin()" 
                    style="margin-top:12px;padding:8px 20px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px">
              🔄 Coba Lagi
            </button>
          </div>
        `;
      }
    }
  };
}

// ==========================================
// 📦 Export Functions to Global Scope
// ==========================================

window.SubmissionDB = SubmissionDB;
window.CompanyDB = CompanyDB;

if (typeof window.loadInitialData === 'undefined') {
  window.loadInitialData = loadInitialData;
}
window.loadSubmissions = loadSubmissions;
window.renderSubmissionList = renderSubmissionList;
window.updateDashboardStats = updateDashboardStats;
window.showEmptyState = showEmptyState;

if (typeof window.loadCompaniesForLogin === 'undefined') {
  window.loadCompaniesForLogin = loadCompaniesForLogin;
}

console.log('%c📊 Firestore DB module loaded successfully', 'color: #3b82f6; font-size: 11px;');
console.log('%c🔗 Connected to: config.js → firebase-init.js → utils.js → app.js', 'color: #10b981; font-size: 10px;');
console.log('%c🔧 Critical fix: Company Document ID = company code (v3.8.6)', 'color: #22c55e; font-size: 10px; font-weight: bold;');

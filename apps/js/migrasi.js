/**
 * ============================================
 * FinanceSync Pro - Firebase Migration Module
 * ============================================
 * Terintegrasi dengan index.html - Menggunakan Firebase instances yang sudah ada
 * 
 * ⚠️ PENTING: File ini HARUS di-load SETELAH firebase-init.js dan firestore-db.js
 * 
 * 🔧 FITUR:
 * • Menggunakan firebaseApp/firebaseDb yang sudah terinisialisasi
 * • Safe serialization untuk Firestore special types
 * • Batch write dengan limit 500 ops
 * • Retry logic untuk transient errors
 * • UI integration dengan helper functions dari index.html
 */

// ==========================================
// 🔥 FIREBASE CONFIGURATIONS (Edit sesuai project Anda)
// ==========================================

const SOURCE_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAc78YtHdF6uaE5mr4inU8xG4EYDU5FWVY",
  authDomain: "ai-devender-7b55c.firebaseapp.com",
  databaseURL: "https://ai-devender-7b55c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ai-devender-7b55c",
  storageBucket: "ai-devender-7b55c.firebasestorage.app",
  messagingSenderId: "11961460704",
  appId: "1:11961460704:web:f6ca0b3a1e329856486d85"
};

const TARGET_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDfIvUOLqAULR9eKy0rkqJfY_99Q4rxy2M",
  authDomain: "pencatatan-voucher-perusahaan.firebaseapp.com",
  databaseURL: "https://pencatatan-voucher-perusahaan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pencatatan-voucher-perusahaan",
  storageBucket: "pencatatan-voucher-perusahaan.firebasestorage.app",
  messagingSenderId: "5344554002",
  appId: "1:5344554002:web:9137a500fbb8f3223b7ccb"
};

// Collection yang akan di-scan (sesuaikan dengan struktur data Anda)
const COLLECTIONS_TO_SCAN = [
  'Invoice-NMSA',    // Akan di-map ke 'submissions'
  'companies',
  'users',
  'submissions'
];

// Mapping collection name: Source → Target
const COLLECTION_MAPPING = {
  'Invoice-NMSA': 'submissions',  // Rename saat migrasi
  'companies': 'companies',
  'users': 'users',
  'submissions': 'submissions'
};

// Settings migrasi
const MIGRATION_SETTINGS = {
  batchSize: 400,           // Stay under 500 ops limit
  delayBetweenBatches: 300, // ms
  pageSize: 500,            // docs per pagination
  maxRetries: 3,            // retry attempts for transient errors
  retryDelay: 1000          // ms
};

// ==========================================
// 🌐 GLOBAL STATE & VARIABLES
// ==========================================

let sourceApp = null;
let targetApp = null;
let sourceDb = null;
let targetDb = null;

const MigrationState = {
  isScanned: false,
  isRunning: false,
  startTime: null,
  scannedCollections: [],
  selectedCollections: [],
  stats: {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  },
  log: []
};

// ==========================================
// 🚀 INITIALIZATION
// ==========================================

/**
 * Initialize migration module
 * Dipanggil otomatis saat file di-load, atau manual via window.initMigration()
 */
function initMigration() {
  console.log('%c🔄 Initializing Migration Module...', 'color: #f59e0b; font-size: 12px; font-weight: bold;');
  
  try {
    // Update UI dengan project names
    updateProjectInfo();
    
    // Setup event listeners untuk tombol-tombol di modal
    setupMigrationEventListeners();
    
    // Log ke UI
    addMigrationLogEntry('🟢 Migration module ready', 'info');
    addMigrationLogEntry('💡 Klik "Scan Source" untuk memulai', 'info');
    
    console.log('%c✅ Migration module initialized', 'color: #10b981; font-size: 11px;');
    
  } catch (err) {
    console.error('❌ Migration init error:', err);
    addMigrationLogEntry(`❌ Init error: ${err.message}`, 'error');
  }
}

/**
 * Update UI dengan nama project source/target
 */
function updateProjectInfo() {
  const sourceEl = document.getElementById('migSourceProject');
  const targetEl = document.getElementById('migTargetProject');
  
  if (sourceEl) sourceEl.textContent = SOURCE_FIREBASE_CONFIG.projectId;
  if (targetEl) targetEl.textContent = TARGET_FIREBASE_CONFIG.projectId;
}

/**
 * Setup event listeners untuk tombol-tombol migrasi
 */
function setupMigrationEventListeners() {
  // Tombol Scan
  const btnScan = document.getElementById('btnScan');
  if (btnScan) {
    btnScan.onclick = function() {
      if (typeof runMigrationScan === 'function') {
        runMigrationScan();
      }
    };
  }
  
  // Tombol Migrate
  const btnMigrate = document.getElementById('btnMigrate');
  if (btnMigrate) {
    btnMigrate.onclick = function() {
      if (typeof startMigrationProcess === 'function') {
        startMigrationProcess();
      }
    };
  }
  
  // Tombol Verify
  const btnVerify = document.getElementById('btnVerify');
  if (btnVerify) {
    btnVerify.onclick = function() {
      if (typeof verifyMigration === 'function') {
        verifyMigration();
      }
    };
  }
  
  // Tombol Report
  const btnReport = document.getElementById('btnReport');
  if (btnReport) {
    btnReport.onclick = function() {
      if (typeof downloadMigrationReport === 'function') {
        downloadMigrationReport();
      }
    };
  }
  
  // Tombol Clear Log
  const btnClear = document.getElementById('btnClear');
  if (btnClear) {
    btnClear.onclick = function() {
      if (typeof clearMigrationLog === 'function') {
        clearMigrationLog();
      }
    };
  }
  
  console.log('%c🔗 Event listeners attached', 'color: #8b5cf6; font-size: 11px;');
}

// Auto-init saat DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMigration);
} else {
  initMigration();
}

// Export ke global scope
window.initMigration = initMigration;

// ==========================================
// 🔍 SCAN SOURCE PROJECT
// ==========================================

/**
 * Scan collection di source project
 * Dipanggil dari tombol "Scan Source" di UI
 */
async function runMigrationScan() {
  try {
    addMigrationLogEntry('🔍 Scanning source project...', 'info');
    setButtonLoading('btnScan', true);
    
    MigrationState.scannedCollections = [];
    
    // Initialize source Firebase app (separate instance)
    await initSourceFirebase();
    
    for (const collName of COLLECTIONS_TO_SCAN) {
      try {
        addMigrationLogEntry(`  📡 Checking: ${collName}`, 'info');
        
        // Check if collection exists and has docs
        const snapshot = await sourceDb.collection(collName).limit(1).get();
        
        if (!snapshot.empty) {
          // Get full count
          const fullSnap = await sourceDb.collection(collName).get();
          const sampleDoc = snapshot.docs[0];
          
          // Safe serialize sample data for display
          const sampleData = safeSerialize(sampleDoc.data());
          
          MigrationState.scannedCollections.push({
            name: collName,
            count: fullSnap.size,
            sampleId: sampleDoc.id,
            sampleData: sampleData,
            targetName: COLLECTION_MAPPING[collName] || collName
          });
          
          const targetNote = collName !== (COLLECTION_MAPPING[collName] || collName) 
            ? ` → ${COLLECTION_MAPPING[collName]}` 
            : '';
          
          addMigrationLogEntry(`  ✅ Found ${fullSnap.size} docs in "${collName}"${targetNote}`, 'success');
          
        } else {
          addMigrationLogEntry(`  ⚠️ Collection "${collName}" kosong/tidak ada`, 'warning');
        }
        
      } catch (err) {
        addMigrationLogEntry(`  ❌ Error scan ${collName}: ${err.message}`, 'error');
        console.error(`Scan error for ${collName}:`, err);
      }
    }
    
    if (MigrationState.scannedCollections.length === 0) {
      addMigrationLogEntry('❌ Tidak ada collection ditemukan!', 'error');
      addMigrationLogEntry('💡 Periksa nama collection atau Firestore rules', 'warning');
      setButtonLoading('btnScan', false);
      return;
    }
    
    // Update UI
    MigrationState.isScanned = true;
    renderCollectionList();
    showScanResult();
    
    // Enable migrate button
    setMigrationButtonsState(true, false, false);
    
    addMigrationLogEntry(`🎉 Scan selesai! ${MigrationState.scannedCollections.length} collection ditemukan`, 'success');
    
  } catch (err) {
    addMigrationLogEntry(`❌ Scan error: ${err.message}`, 'error');
    console.error(err);
  } finally {
    setButtonLoading('btnScan', false);
  }
}

/**
 * Initialize Firebase app untuk source project (instance terpisah)
 */
async function initSourceFirebase() {
  try {
    // Cek apakah sudah terinisialisasi
    if (sourceApp && sourceDb) {
      return; // Sudah ready
    }
    
    // Buat instance terpisah untuk source project
    if (!firebase.apps.find(a => a.name === 'migrationSource')) {
      sourceApp = firebase.initializeApp(SOURCE_FIREBASE_CONFIG, 'migrationSource');
    } else {
      sourceApp = firebase.app('migrationSource');
    }
    
    sourceDb = sourceApp.firestore();
    sourceDb.settings({ ignoreUndefinedProperties: true });
    
    addMigrationLogEntry('✅ Source Firebase initialized', 'success');
    
  } catch (err) {
    addMigrationLogEntry(`❌ Source init error: ${err.message}`, 'error');
    console.error(err);
    throw err;
  }
}

/**
 * Render list collection ke UI checkbox
 */
function renderCollectionList() {
  const container = document.getElementById('collectionList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (MigrationState.scannedCollections.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:#94a3b8; font-size:13px;">
        <div style="font-size:36px;margin-bottom:10px;">📭</div>
        Tidak ada collection ditemukan
      </div>
    `;
    return;
  }
  
  MigrationState.scannedCollections.forEach(coll => {
    const isMapped = coll.targetName !== coll.name;
    
    const item = document.createElement('label');
    item.className = 'mig-checkbox-item';
    item.innerHTML = `
      <input type="checkbox" class="coll-checkbox" data-name="${coll.name}" checked>
      <div class="info">
        <div class="name">📂 ${coll.name} ${isMapped ? `<span style="color:#10b981;">→ ${coll.targetName}</span>` : ''}</div>
        <div class="desc">
          ${isMapped ? '🔄 Akan di-rename saat dipindah' : '📋 Nama tetap sama'} 
          • Sample ID: <code style="color:#64748b;">${coll.sampleId}</code>
        </div>
      </div>
      <div class="count">${coll.count} docs</div>
    `;
    
    // Add click handler for visual selection
    const checkbox = item.querySelector('input[type="checkbox"]');
    item.addEventListener('click', function(e) {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        item.classList.toggle('selected', checkbox.checked);
      }
    });
    
    // Sync visual state with checkbox
    checkbox.addEventListener('change', function() {
      item.classList.toggle('selected', this.checked);
    });
    
    // Initial state
    if (checkbox.checked) {
      item.classList.add('selected');
    }
    
    container.appendChild(item);
  });
}

/**
 * Show scan result summary
 */
function showScanResult() {
  const resultEl = document.getElementById('scanResult');
  if (!resultEl) return;
  
  const totalDocs = MigrationState.scannedCollections.reduce((sum, c) => sum + c.count, 0);
  
  resultEl.innerHTML = `
    <strong style="color:#10b981;">✅ Scan Berhasil!</strong> 
    Ditemukan <strong style="color:#6366f1;">${MigrationState.scannedCollections.length}</strong> collection 
    dengan total <strong style="color:#f59e0b;">${totalDocs}</strong> dokumen.
  `;
  resultEl.classList.add('active');
}

// ==========================================
// 🚀 MAIN MIGRATION PROCESS
// ==========================================

/**
 * Start migration process
 * Dipanggil dari tombol "Mulai Migrasi"
 */
async function startMigrationProcess() {
  try {
    if (MigrationState.isRunning) {
      addMigrationLogEntry('⚠️ Migrasi sedang berjalan...', 'warning');
      return;
    }
    
    // Get selected collections
    const checkboxes = document.querySelectorAll('.coll-checkbox:checked');
    const selected = Array.from(checkboxes).map(cb => cb.dataset.name);
    
    if (selected.length === 0) {
      alert('Pilih minimal 1 collection untuk dimigrasi!');
      return;
    }
    
    // Get options from UI
    const options = {
      preserveId: document.getElementById('optPreserveId')?.checked ?? true,
      addMetadata: document.getElementById('optAddMetadata')?.checked ?? true,
      overwrite: document.getElementById('optOverwrite')?.checked ?? false,
      dryRun: document.getElementById('optDryRun')?.checked ?? false
    };
    
    // Calculate total docs
    const totalDocs = MigrationState.scannedCollections
      .filter(c => selected.includes(c.name))
      .reduce((sum, c) => sum + c.count, 0);
    
    // Confirmation dialog
    const modeText = options.dryRun ? '🧪 DRY RUN (simulasi)' : '⚡ LIVE MODE';
    const msg = `
🚀 KONFIRMASI MIGRASI

Source: ${SOURCE_FIREBASE_CONFIG.projectId}
Target: ${TARGET_FIREBASE_CONFIG.projectId}

Collections: ${selected.join(', ')}
Total dokumen: ${totalDocs}

Opsi:
${options.preserveId ? '✅' : '❌'} Pertahankan Document ID
${options.addMetadata ? '✅' : '❌'} Tambah metadata migrasi
${options.overwrite ? '✅' : '❌'} Overwrite jika sudah ada
${modeText}

Lanjutkan?
    `.trim();
    
    if (!confirm(msg)) return;
    
    // Initialize state
    MigrationState.isRunning = true;
    MigrationState.startTime = Date.now();
    MigrationState.selectedCollections = selected;
    MigrationState.stats = { total: 0, success: 0, failed: 0, skipped: 0, errors: [] };
    
    // Update UI
    setButtonLoading('btnMigrate', true);
    setMigrationButtonsState(false, false, false);
    updateMigrationProgress(0, 'Memulai migrasi...');
    
    addMigrationLogEntry(`\n${'='.repeat(50)}`, 'info');
    addMigrationLogEntry(`🚀 MIGRATION STARTED ${options.dryRun ? '(DRY RUN)' : ''}`, 'success');
    addMigrationLogEntry(`${'='.repeat(50)}`, 'info');
    
    // Initialize target Firebase (use existing instance if same project)
    await initTargetFirebase();
    
    // Process each collection
    for (const collName of selected) {
      await migrateCollection(collName, options);
    }
    
    // Finalize
    const duration = ((Date.now() - MigrationState.startTime) / 1000).toFixed(2);
    
    addMigrationLogEntry(`\n${'='.repeat(50)}`, 'info');
    addMigrationLogEntry(`🎉 MIGRATION COMPLETED dalam ${duration}s`, 'success');
    addMigrationLogEntry(`✅ Success: ${MigrationState.stats.success}`, 'success');
    addMigrationLogEntry(`❌ Failed: ${MigrationState.stats.failed}`, 'error');
    addMigrationLogEntry(`⏭️ Skipped: ${MigrationState.stats.skipped}`, 'warning');
    addMigrationLogEntry(`${'='.repeat(50)}`, 'info');
    
    // Update stats UI
    updateMigrationStats(
      MigrationState.stats.total,
      MigrationState.stats.success,
      MigrationState.stats.failed,
      MigrationState.stats.skipped
    );
    
    MigrationState.isRunning = false;
    setButtonLoading('btnMigrate', false);
    setMigrationButtonsState(false, true, true);
    
    // Show completion alert
    const alertMsg = options.dryRun 
      ? `🧪 Dry Run selesai!\n\nAkan migrate: ${MigrationState.stats.success} dokumen\n\nUncheck "Dry Run" untuk migrasi sungguhan.`
      : `✅ Migrasi selesai!\n\nBerhasil: ${MigrationState.stats.success}\nGagal: ${MigrationState.stats.failed}\nDilewati: ${MigrationState.stats.skipped}`;
    
    alert(alertMsg);
    
  } catch (err) {
    addMigrationLogEntry(`❌ FATAL: ${err.message}`, 'error');
    console.error(err);
    MigrationState.isRunning = false;
    setButtonLoading('btnMigrate', false);
  }
}

/**
 * Initialize target Firebase app
 * Jika target project sama dengan app utama, gunakan instance yang sudah ada
 */
async function initTargetFirebase() {
  try {
    const targetProjectId = TARGET_FIREBASE_CONFIG.projectId;
    const currentProjectId = typeof APP_CONFIG !== 'undefined' 
      ? APP_CONFIG.firebase?.projectId 
      : null;
    
    // Jika target sama dengan project saat ini, gunakan instance yang sudah ada
    if (targetProjectId === currentProjectId && typeof firebaseDb !== 'undefined' && firebaseDb) {
      targetDb = firebaseDb;
      addMigrationLogEntry('✅ Using existing Firebase instance for target', 'success');
      return;
    }
    
    // Jika berbeda, buat instance terpisah
    if (!firebase.apps.find(a => a.name === 'migrationTarget')) {
      targetApp = firebase.initializeApp(TARGET_FIREBASE_CONFIG, 'migrationTarget');
    } else {
      targetApp = firebase.app('migrationTarget');
    }
    
    targetDb = targetApp.firestore();
    targetDb.settings({ ignoreUndefinedProperties: true });
    
    addMigrationLogEntry('✅ Target Firebase initialized (separate instance)', 'success');
    
  } catch (err) {
    addMigrationLogEntry(`❌ Target init error: ${err.message}`, 'error');
    console.error(err);
    throw err;
  }
}

// ==========================================
// 📦 MIGRATE SINGLE COLLECTION
// ==========================================

async function migrateCollection(sourceCollName, options) {
  try {
    const targetCollName = COLLECTION_MAPPING[sourceCollName] || sourceCollName;
    
    addMigrationLogEntry(`\n📂 Migrating: ${sourceCollName} → ${targetCollName}`, 'info');
    
    // Fetch all docs from source
    const allDocs = await fetchAllDocs(sourceCollName);
    MigrationState.stats.total += allDocs.length;
    
    addMigrationLogEntry(`  📊 Total: ${allDocs.length} dokumen`, 'info');
    
    if (allDocs.length === 0) {
      addMigrationLogEntry(`  ⚠️ Tidak ada data untuk dimigrasi`, 'warning');
      return;
    }
    
    // Process in batches
    const batchSize = MIGRATION_SETTINGS.batchSize;
    const totalBatches = Math.ceil(allDocs.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, allDocs.length);
      const batchDocs = allDocs.slice(start, end);
      
      addMigrationLogEntry(`  📦 Batch ${i + 1}/${totalBatches} (${batchDocs.length} docs)`, 'info');
      
      await processBatch(batchDocs, targetCollName, sourceCollName, options);
      
      // Update progress
      const progress = ((start + batchDocs.length) / MigrationState.stats.total) * 100;
      updateMigrationProgress(progress, `Processing ${sourceCollName}...`);
      
      // Delay between batches to avoid rate limits
      if (i < totalBatches - 1) {
        await sleep(MIGRATION_SETTINGS.delayBetweenBatches);
      }
    }
    
    addMigrationLogEntry(`  ✅ Collection "${sourceCollName}" selesai`, 'success');
    
  } catch (err) {
    addMigrationLogEntry(`  ❌ Error: ${err.message}`, 'error');
    console.error(err);
    MigrationState.stats.errors.push({ collection: sourceCollName, error: err.message });
  }
}

/**
 * Fetch all documents from a collection with pagination
 */
async function fetchAllDocs(collName) {
  const allDocs = [];
  let lastDoc = null;
  let hasMore = true;
  
  while (hasMore) {
    let query = sourceDb.collection(collName).limit(MIGRATION_SETTINGS.pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    
    const snapshot = await query.get();
    if (snapshot.empty) break;
    
    snapshot.forEach(doc => {
      // Safe serialize to handle Firestore special types
      const serializedData = safeSerialize(doc.data());
      allDocs.push({ id: doc.id, data: serializedData });
    });
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.size === MIGRATION_SETTINGS.pageSize;
  }
  
  return allDocs;
}

// ==========================================
// 🔐 SAFE SERIALIZATION (CRITICAL FIX)
// ==========================================

/**
 * Serialize Firestore data to plain JSON, handling special types
 * Mencegah error saat copy dokumen dengan sentinel values
 */
function safeSerialize(data) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => safeSerialize(item));
  }
  
  // Handle Firestore Timestamp
  if (data instanceof firebase.firestore.Timestamp) {
    return data.toDate(); // Convert to native Date
  }
  
  // Handle Firestore GeoPoint
  if (data instanceof firebase.firestore.GeoPoint) {
    return { _type: 'GeoPoint', latitude: data.latitude, longitude: data.longitude };
  }
  
  // Handle Firestore Blob (skip to avoid errors)
  if (data instanceof firebase.firestore.Blob) {
    console.warn('⚠️ Firestore Blob detected - skipped in migration');
    return null;
  }
  
  // Handle Firestore FieldValue sentinels
  if (data && typeof data === 'object' && data._methodName) {
    console.warn(`⚠️ Sentinel value ${data._methodName} detected - replaced with null`);
    return null;
  }
  
  // Handle Firestore DocumentReference
  if (data instanceof firebase.firestore.DocumentReference) {
    return { _type: 'DocumentReference', path: data.path };
  }
  
  // Handle nested objects recursively
  const result = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      result[key] = safeSerialize(data[key]);
    }
  }
  
  return result;
}

// ==========================================
// 📦 PROCESS BATCH
// ==========================================

async function processBatch(docs, targetCollName, sourceCollName, options) {
  // Dry run mode - just count, don't write
  if (options.dryRun) {
    docs.forEach(doc => {
      MigrationState.stats.success++;
      addMigrationLogEntry(`    🧪 [DRY] Would migrate: ${doc.id}`, 'info');
    });
    updateMigrationStats(
      MigrationState.stats.total,
      MigrationState.stats.success,
      MigrationState.stats.failed,
      MigrationState.stats.skipped
    );
    return;
  }
  
  // Check for existing docs if overwrite is disabled
  if (!options.overwrite) {
    const existsCheck = await Promise.all(
      docs.map(doc => 
        targetDb.collection(targetCollName).doc(doc.id).get()
          .then(snap => ({ id: doc.id, exists: snap.exists }))
          .catch(err => {
            addMigrationLogEntry(`    ⚠️ Check failed for ${doc.id}: ${err.message}`, 'warning');
            return { id: doc.id, exists: false };
          })
      )
    );
    
    const existingIds = new Set(existsCheck.filter(e => e.exists).map(e => e.id));
    
    if (existingIds.size > 0) {
      addMigrationLogEntry(`    ⏭️ Skip ${existingIds.size} dokumen (sudah ada)`, 'warning');
      MigrationState.stats.skipped += existingIds.size;
      docs = docs.filter(d => !existingIds.has(d.id));
    }
  }
  
  if (docs.length === 0) {
    updateMigrationStats(
      MigrationState.stats.total,
      MigrationState.stats.success,
      MigrationState.stats.failed,
      MigrationState.stats.skipped
    );
    return;
  }
  
  // Split into sub-batches if needed (max 500 ops per batch)
  const maxBatchSize = 500;
  for (let i = 0; i < docs.length; i += maxBatchSize) {
    const subBatch = docs.slice(i, i + maxBatchSize);
    await writeBatchWithRetry(subBatch, targetCollName, sourceCollName, options);
  }
  
  updateMigrationStats(
    MigrationState.stats.total,
    MigrationState.stats.success,
    MigrationState.stats.failed,
    MigrationState.stats.skipped
  );
}

async function writeBatchWithRetry(docs, targetCollName, sourceCollName, options, attempt = 1) {
  try {
    const batch = targetDb.batch();
    
    for (const doc of docs) {
      try {
        const transformed = transformData(doc.data, sourceCollName, doc.id, options);
        
        const ref = options.preserveId
          ? targetDb.collection(targetCollName).doc(doc.id)
          : targetDb.collection(targetCollName).doc();
        
        batch.set(ref, transformed);
      } catch (err) {
        MigrationState.stats.failed++;
        addMigrationLogEntry(`    ❌ Prep failed ${doc.id}: ${err.message}`, 'error');
        console.error(`Prep error for ${doc.id}:`, err);
      }
    }
    
    await batch.commit();
    MigrationState.stats.success += docs.length;
    addMigrationLogEntry(`    ✅ Committed ${docs.length} docs`, 'success');
    
  } catch (err) {
    // Retry logic for transient errors
    if (attempt < MIGRATION_SETTINGS.maxRetries && isRetryableError(err)) {
      addMigrationLogEntry(`    🔄 Retry ${attempt}/${MIGRATION_SETTINGS.maxRetries} for batch...`, 'warning');
      await sleep(MIGRATION_SETTINGS.retryDelay * attempt);
      return writeBatchWithRetry(docs, targetCollName, sourceCollName, options, attempt + 1);
    }
    
    addMigrationLogEntry(`    ❌ Batch failed: ${err.message}`, 'error');
    console.error('Batch commit error:', err);
    
    // Fallback to individual writes
    addMigrationLogEntry(`    🔄 Fallback to individual writes...`, 'warning');
    await writeIndividually(docs, targetCollName, sourceCollName, options);
  }
}

function isRetryableError(err) {
  const msg = err.message?.toLowerCase() || '';
  return msg.includes('timeout') || 
         msg.includes('network') || 
         msg.includes('unavailable') ||
         msg.includes('aborted');
}

async function writeIndividually(docs, targetCollName, sourceCollName, options) {
  for (const doc of docs) {
    try {
      const transformed = transformData(doc.data, sourceCollName, doc.id, options);
      const ref = options.preserveId
        ? targetDb.collection(targetCollName).doc(doc.id)
        : targetDb.collection(targetCollName).doc();
      
      await ref.set(transformed);
      MigrationState.stats.success++;
    } catch (err) {
      MigrationState.stats.failed++;
      addMigrationLogEntry(`      ❌ ${doc.id}: ${err.message}`, 'error');
      console.error(`Individual write error for ${doc.id}:`, err);
    }
  }
}

// ==========================================
// 🔄 DATA TRANSFORMATION
// ==========================================

function transformData(data, sourceCollName, docId, options) {
  // Start with already-serialized data
  const transformed = { ...data };
  
  // Add migration metadata if enabled
  if (options.addMetadata) {
    transformed._migrated_at = new Date();
    transformed._migrated_from = sourceCollName;
    transformed._original_id = docId;
    transformed._source_project = SOURCE_FIREBASE_CONFIG.projectId;
  }
  
  // Collection-specific transformations
  if (sourceCollName === 'Invoice-NMSA' || sourceCollName === 'submissions') {
    // Ensure required fields with defaults
    transformed.status = transformed.status || 'Belum Lunas';
    transformed.items = Array.isArray(transformed.items) ? transformed.items : [];
    transformed.files = Array.isArray(transformed.files) ? transformed.files : [];
    
    // Ensure numeric fields are numbers
    if (transformed.totalNominal) {
      transformed.totalNominal = Number(transformed.totalNominal) || 0;
    }
  }
  
  return transformed;
}

// ==========================================
// ✅ VERIFICATION
// ==========================================

async function verifyMigration() {
  try {
    addMigrationLogEntry('\n🔍 Verifying migration...', 'info');
    setButtonLoading('btnVerify', true);
    
    for (const collName of MigrationState.selectedCollections) {
      const targetCollName = COLLECTION_MAPPING[collName] || collName;
      
      // Use count() API if available, fallback to get().size
      let sourceCount = 0, targetCount = 0;
      
      try {
        const sourceSnap = await sourceDb.collection(collName).count().get();
        sourceCount = sourceSnap.data().count;
      } catch {
        const sourceSnap = await sourceDb.collection(collName).get();
        sourceCount = sourceSnap.size;
      }
      
      try {
        const targetSnap = await targetDb.collection(targetCollName).count().get();
        targetCount = targetSnap.data().count;
      } catch {
        const targetSnap = await targetDb.collection(targetCollName).get();
        targetCount = targetSnap.size;
      }
      
      const match = sourceCount === targetCount;
      const icon = match ? '✅' : '⚠️';
      const type = match ? 'success' : 'warning';
      
      addMigrationLogEntry(`${icon} ${collName} → ${targetCollName}`, type);
      addMigrationLogEntry(`   Source: ${sourceCount} | Target: ${targetCount}`, type);
      
      if (!match) {
        addMigrationLogEntry(`   ⚠️ Mismatch! Check for errors above.`, 'warning');
      }
    }
    
    addMigrationLogEntry('\n✅ Verifikasi selesai', 'success');
    
  } catch (err) {
    addMigrationLogEntry(`❌ Verify error: ${err.message}`, 'error');
    console.error(err);
  } finally {
    setButtonLoading('btnVerify', false);
  }
}

// ==========================================
// 📥 DOWNLOAD REPORT
// ==========================================

function downloadMigrationReport() {
  const report = {
    summary: {
      source: SOURCE_FIREBASE_CONFIG.projectId,
      target: TARGET_FIREBASE_CONFIG.projectId,
      duration: MigrationState.startTime 
        ? ((Date.now() - MigrationState.startTime) / 1000).toFixed(2) + 's' 
        : 'N/A',
      collections: MigrationState.selectedCollections,
      ...MigrationState.stats
    },
    logs: MigrationState.log.slice(-500), // Last 500 entries
    generatedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `migrasi-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  addMigrationLogEntry('📥 Report downloaded', 'success');
}

// ==========================================
// 🛠️ UTILITIES & UI HELPERS
// ==========================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Set loading state for a button
 * @param {string} btnId - Button element ID
 * @param {boolean} loading - Loading state
 */
function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Loading...';
  } else if (btn.dataset.originalText) {
    btn.innerHTML = btn.dataset.originalText;
    delete btn.dataset.originalText;
  }
}

// Export functions to global scope for HTML onclick handlers
window.runMigrationScan = runMigrationScan;
window.startMigrationProcess = startMigrationProcess;
window.verifyMigration = verifyMigration;
window.downloadMigrationReport = downloadMigrationReport;

// Helper functions that call the ones from index.html
window.clearMigrationLog = function() {
  if (typeof clearMigrationLog === 'function') {
    clearMigrationLog(); // Call the one from index.html
  }
};

// Console log for debugging
console.log('%c🔄 js/migrasi.js loaded - Migration module ready', 'color: #f59e0b; font-size: 11px; font-weight: bold;');

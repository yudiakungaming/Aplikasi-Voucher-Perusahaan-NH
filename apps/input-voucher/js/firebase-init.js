/**
 * ============================================
 * FinanceSync Pro v3.8.1 - Firebase Initialization
 * ============================================
 * 
 * ✅ VERSION: Fixed v3.8.5
 * 🎯 FIX: 
 *   1. Graceful handling for "Missing or insufficient permissions" 
 *   2. 🔧 FIXED: doc.exists is not a function (SDK compatibility)
 *   3. 🔧 IMPROVED: Connection monitor doesn't show "Offline" for metadata errors
 *   4. 🔧 CRITICAL: Persistence DISABLED - write langsung ke server (no local cache)
 * 
 * ⚠️ SDK VERSION REQUIREMENT:
 *   - Gunakan Firebase SDK v8 (namespaced) ATAU v9+ (modular) secara KONSISTEN
 *   - Jangan campur kedua style dalam satu project
 * 
 * 📦 Jika pakai v8 (namespaced) - script di HTML:
 *   <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
 */

// ==========================================
// 🔧 Global Variables
// ==========================================

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let isFirebaseReady = false;
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

let isBootstrapping = false;
let isAuthListenerSetup = false;

// ==========================================
// 🔥 Firebase Initialization
// ==========================================

async function initializeFirebase() {
  try {
    if (window.setLoaderProgress) {
      window.setLoaderProgress(2, '🔥 Menghubungkan ke Firebase...');
    } else if (typeof LoadingManager !== 'undefined') {
      LoadingManager.updateMessage('🔥 Menghubungkan ke Firebase...');
    }

    console.log('%c🔥 Initializing Firebase...', 'color: #f59e0b; font-size: 12px;');

    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK tidak ter-load. Cek script tags di HTML.');
    }

    if (typeof APP_CONFIG === 'undefined') {
      throw new Error('APP_CONFIG tidak ditemukan');
    }

    if (!firebaseApp) {
      firebaseApp = firebase.initializeApp(APP_CONFIG.firebase);
      console.log('✅ Firebase App initialized:', APP_CONFIG.firebase.projectId);
    } else {
      console.log('ℹ️ Firebase App already initialized');
    }

    if (window.setLoaderProgress) {
      window.setLoaderProgress(3, '🔐 Menyiapkan autentikasi...');
    } else if (typeof LoadingManager !== 'undefined') {
      LoadingManager.updateMessage('🔐 Menyiapkan autentikasi...');
    }

    if (!firebaseAuth) {
      firebaseAuth = firebase.auth();
      console.log('✅ Firebase Auth initialized');
    }

    if (!firebaseDb) {
      firebaseDb = firebase.firestore();

      // 🔧 CRITICAL FIX v3.8.5: DISABLE persistence - write langsung ke server
      // Jika persistence aktif, data bisa tersimpan di local (IndexedDB) dan gagal sync ke server
      // Untuk aplikasi yang selalu online, lebih aman write langsung ke server
      try {
        // await firebaseDb.enablePersistence({ synchronizeTabs: true });
        // console.log('✅ Firestore persistence enabled');
        console.log('ℹ️ Firestore persistence DISABLED - write langsung ke server (v3.8.5)');
      } catch (persistenceError) {
        console.warn('⚠️ Firestore persistence not enabled:', persistenceError.message);
      }

      console.log('✅ Firestore initialized');
    }

    isFirebaseReady = true;

    if (window.setLoaderProgress) {
      window.setLoaderProgress(4, '📊 Memuat data perusahaan...');
    } else if (typeof LoadingManager !== 'undefined') {
      LoadingManager.updateMessage('📊 Memuat data perusahaan...');
    }

    return true;

  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);

    initRetryCount++;

    if (initRetryCount <= MAX_INIT_RETRIES) {
      console.log(`🔄 Retrying... (${initRetryCount}/${MAX_INIT_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      return initializeFirebase();
    } else {
      console.error('❌ Max retries reached');

      if (typeof LoadingManager !== 'undefined') {
        LoadingManager.updateMessage('❌ Gagal menghubungkan Firebase');
        LoadingManager.showError();
      }

      if (typeof Toast !== 'undefined') {
        Toast.error('Gagal menghubungkan ke Firebase');
      }

      return false;
    }
  }
}

// ==========================================
// 👤 Authentication State Management
// ==========================================

function setupAuthListener(onSignIn, onSignOut) {
  if (isAuthListenerSetup) {
    console.log('ℹ️ Auth listener already setup');
    return;
  }

  if (!firebaseAuth) {
    console.error('❌ Firebase Auth not initialized');
    return;
  }

  isAuthListenerSetup = true;

  firebaseAuth.onAuthStateChanged(async function(user) {
    console.log('👤 Auth state changed:', user ? 'signed in' : 'signed out');

    try {
      if (user) {
        console.log('✅ User logged in:', user.email);

        updateConnectionStatus('ok', 'Terhubung');

        if (typeof window.updateAuthUI === 'function') {
          window.updateAuthUI();
        }

        showDashboard();
        updateHeaderAuth(user);

        await loadCompaniesForLogin();
        await _checkAndHandleFirstTimeUser();

        if (typeof onSignIn === 'function') {
          try {
            await onSignIn(user);
          } catch (e) {
            console.error('❌ onSignIn callback error:', e);
          }
        }

        monitorConnectionStatus();

        if (window.setLoaderProgress) {
          setTimeout(function() {
            window.setLoaderProgress(5, '✅ Siap! Selamat datang 👋');
            setTimeout(function() {
              hideLoaderAndShowScreen(true);
            }, 800);
          }, 500);
        } else {
          setTimeout(function() {
            hideLoaderAndShowScreen(true);
          }, 500);
        }

      } else {
        console.log('👋 User not logged in');

        if (typeof window.updateAuthUI === 'function') {
          window.updateAuthUI();
        }

        showLoginScreen();

        var hdrAuth = document.getElementById('hdrAuth');
        if (hdrAuth) hdrAuth.style.display = 'none';

        updateConnectionStatus('loading', 'Menunggu login...');

        await loadCompaniesForLogin();

        if (typeof onSignOut === 'function') {
          try {
            onSignOut();
          } catch (e) {
            console.error('❌ onSignOut error:', e);
          }
        }

        setTimeout(function() {
          hideLoaderAndShowScreen(false);
        }, 300);
      }

    } catch (error) {
      console.error('❌ Auth state change handler error:', error);
      setTimeout(function() {
        hideLoaderAndShowScreen(false);
      }, 300);
    }
  });
}

// ==========================================
// 🆕 First Time User Check
// ==========================================

async function _checkAndHandleFirstTimeUser() {
  console.log('🆕 Checking if first-time user...');

  try {
    var needsSetup = false;

    if (typeof StorageUtils !== 'undefined') {
      needsSetup = StorageUtils.get('financesync_needsFirstCompany') === true;
    }

    if (!needsSetup) {
      if (typeof CompanyDB !== 'undefined' && typeof CompanyDB.getAll === 'function') {
        try {
          var companies = await CompanyDB.getAll();
          needsSetup = companies.length === 0;
        } catch (e) {
          console.warn('Could not check companies:', e);
          needsSetup = false;
        }
      }
    }

    if (needsSetup) {
      console.log('🆕 First-time user detected!');

      if (typeof StorageUtils !== 'undefined') {
        StorageUtils.remove('financesync_needsFirstCompany');
      }

      if (typeof Toast !== 'undefined') {
        setTimeout(function() {
          Toast.info('🏢 Selamat datang! Buat perusahaan pertama Anda.');
        }, 1500);
      }

      setTimeout(function() {
        if (typeof openCompanyModal === 'function') {
          openCompanyModal();

          setTimeout(function() {
            if (typeof switchCompanyTab === 'function') {
              var formTabBtn = document.querySelector('#companyModal .tab-item:nth-child(2)');
              if (formTabBtn) {
                switchCompanyTab('form', formTabBtn);
              }
            }

            setTimeout(function() {
              var nameInput = document.getElementById('compName');
              if (nameInput) {
                nameInput.focus();
                nameInput.placeholder = 'Contoh: PT Saya Sendiri';
                nameInput.style.transition = 'background 0.3s';
                nameInput.style.background = 'rgba(99,102,241, 0.15)';
                setTimeout(function() {
                  nameInput.style.background = '';
                }, 1000);
              }
            }, 800);
          }, 1200);
        }
      }, 2000);
    }

  } catch (error) {
    console.warn('⚠️ Could not run first-time user check:', error);
  }
}

// ==========================================
// 🖥️ Loader & Screen Management
// ==========================================

function hideLoaderAndShowScreen(isDashboard) {
  console.log('🔄 Hiding loader, showing:', isDashboard ? 'dashboard' : 'login');

  if (typeof LoadingManager !== 'undefined') {
    LoadingManager.hide();
  }

  var loader = document.getElementById('appLoader');
  if (loader && loader.style.display !== 'none') {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.4s ease';
    setTimeout(function() {
      loader.style.display = 'none';
    }, 400);
  }

  if (isDashboard) {
    var scrDash = document.getElementById('scrDash');
    if (scrDash) scrDash.style.display = '';
    var scrLogin = document.getElementById('scrLogin');
    if (scrLogin) scrLogin.style.display = 'none';
  } else {
    var scrLogin2 = document.getElementById('scrLogin');
    if (scrLogin2) scrLogin2.style.display = '';
    var scrDash2 = document.getElementById('scrDash');
    if (scrDash2) scrDash2.style.display = 'none';
  }
}

// ==========================================
// 🔐 Login & Logout
// ==========================================

async function loginUser(email, password) {
  try {
    if (!email || !password) {
      throw new Error('Email dan password harus diisi');
    }

    if (typeof Validator !== 'undefined' && !Validator.isValidEmail(email)) {
      throw new Error('Format email tidak valid');
    }

    console.log('🔑 Attempting login...');

    var loginBtn = document.getElementById('lBtn');
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="spinner"></span> Membuka kunci...';
    }

    var userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);

    console.log('✅ Login successful!');

    if (typeof Toast !== 'undefined') {
      Toast.success('Login berhasil! Selamat datang 👋');
    }

    return userCredential;

  } catch (error) {
    console.error('❌ Login failed:', error.code, error.message);

    var errorMessage = 'Login gagal. ';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage += 'Akun tidak ditemukan.';
        break;
      case 'auth/wrong-password':
        errorMessage += 'Password salah.';
        break;
      case 'auth/invalid-email':
        errorMessage += 'Format email tidak valid.';
        break;
      case 'auth/too-many-requests':
        errorMessage += 'Terlalu banyak percobaan.';
        break;
      case 'auth/user-disabled':
        errorMessage += 'Akun dinonaktifkan.';
        break;
      default:
        errorMessage += error.message || 'Terjadi kesalahan.';
    }

    var lErr = document.getElementById('lErr');
    if (lErr) {
      lErr.textContent = errorMessage;
      lErr.classList.add('show');
    }

    if (typeof Toast !== 'undefined') {
      Toast.error(errorMessage);
    }

    throw error;

  } finally {
    var loginBtn2 = document.getElementById('lBtn');
    if (loginBtn2) {
      loginBtn2.disabled = false;
      loginBtn2.innerHTML = '🔑 Masuk ke Dashboard';
    }
  }
}

async function logoutUser() {
  try {
    console.log('🚪 Logging out...');

    await firebaseAuth.signOut();

    console.log('✅ Logout successful');

    if (typeof StorageUtils !== 'undefined') {
      StorageUtils.remove('financesync_selectedCompany');
    }

    if (typeof Toast !== 'undefined') {
      Toast.info('Anda telah logout');
    }

    if (typeof resetForm === 'function') {
      resetForm(true);
    }

    if (typeof revokeAccessToken === 'function') {
      try {
        await revokeAccessToken();
        console.log('🔒 Google Drive token revoked');
      } catch (driveError) {
        console.warn('⚠️ Could not revoke Drive token:', driveError);
      }
    }

    if (typeof window.updateAuthUI === 'function') {
      window.updateAuthUI();
    }

  } catch (error) {
    console.error('❌ Logout failed:', error);
    if (typeof Toast !== 'undefined') {
      Toast.error('Logout gagal');
    }
  }
}

// ==========================================
// 📡 Connection Status - 🔧 IMPROVED v3.8.4
// ==========================================

function updateConnectionStatus(status, message) {
  var sDot = document.getElementById('sDot');
  var sText = document.getElementById('sText');

  if (sDot && sText) {
    sDot.classList.remove('ok', 'loading', 'err');
    sDot.classList.add(status);
    sText.textContent = message;
  }
}

/**
 * 🔧 IMPROVED v3.8.4: Monitor Firestore connection status
 * - Defensive check for SDK compatibility
 * - Doesn't show "Offline" for .info/connected metadata errors
 * - Graceful error handling
 */
function monitorConnectionStatus() {
  if (!firebaseDb) return;

  try {
    var connectedRef = firebaseDb.doc('.info/connected');

    connectedRef.onSnapshot(function(doc) {
      try {
        var isConnected = false;
        
        if (doc && typeof doc.exists === 'function') {
          if (doc.exists()) {
            var data = doc.data();
            isConnected = data && data.connected === true;
          }
        } else if (doc && typeof doc.data === 'function') {
          var data = doc.data();
          isConnected = data && data.connected === true;
        } else if (doc && doc.connected !== undefined) {
          isConnected = doc.connected === true;
        }
        
        if (isConnected) {
          console.log('🟢 Connected to Firestore');
          updateConnectionStatus('ok', 'Online');
        }
        // ✅ Jangan tampilkan "Offline" jika data tidak valid - biarkan status sebelumnya
      } catch (checkError) {
        console.warn('⚠️ Connection status check error (ignoring):', checkError);
        // Jangan update UI pada parse error
      }
    }, function(error) {
      // ✅ GRACEFUL: .info/connected errors are metadata issues, don't show to user
      console.warn('⚠️ Connection monitor listener error (metadata, ignoring):', error.message || error);
      // ❌ JANGAN updateConnectionStatus('err', ...) di sini agar tidak misleading
    });
    
  } catch (error) {
    console.warn('⚠️ Could not setup connection monitor:', error);
  }
}

// ==========================================
// 🖥️ Screen Management
// ==========================================

function showLoginScreen() {
  var scrLogin = document.getElementById('scrLogin');
  var scrDash = document.getElementById('scrDash');

  if (scrLogin) scrLogin.style.display = '';
  if (scrDash) scrDash.style.display = 'none';

  console.log('🖥️ Showing login screen');
}

function showDashboard() {
  var scrLogin = document.getElementById('scrLogin');
  var scrDash = document.getElementById('scrDash');

  if (scrLogin) scrLogin.style.display = 'none';
  if (scrDash) scrDash.style.display = '';

  console.log('🖥️ Showing dashboard');
}

function updateHeaderAuth(user) {
  var hdrAuth = document.getElementById('hdrAuth');
  var hdrBadge = document.getElementById('hdrBadge');
  var hdrEmail = document.getElementById('hdrEmail');

  if (hdrAuth) hdrAuth.style.display = 'flex';
  if (hdrEmail && user) hdrEmail.textContent = user.email;

  if (typeof StorageUtils !== 'undefined') {
    var selectedCompany = StorageUtils.get('financesync_selectedCompany');
    if (selectedCompany && hdrBadge) {
      hdrBadge.innerHTML = '<span>' + (selectedCompany.icon || '🏢') + '</span><span>' + selectedCompany.name + '</span>';
      var color = selectedCompany.color || (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.theme.primaryColor : '#6366f1');
      hdrBadge.style.background = color + '20';
      hdrBadge.style.color = color;
      hdrBadge.style.border = '1px solid ' + color + '40';
    }
  }
}

// ==========================================
// 🏢 Company Loading - ✅ GRACEFULLY HANDLED
// ==========================================

async function loadCompaniesForLogin() {
  console.log('🏢 Starting company load process...');

  var TIMEOUT_MS = 10000;
  var timeoutId;

  var timeoutPromise = new Promise(function(_, reject) {
    timeoutId = setTimeout(function() {
      reject(new Error('Timeout: Gagal memuat dalam 10 detik'));
    }, TIMEOUT_MS);
  });

  try {
    await Promise.race([_loadCompaniesInternal(), timeoutPromise]);
    console.log('✅ Company load completed successfully');

  } catch (error) {
    const errorMsg = error.message || error.toString() || '';
    const isPermissionError = errorMsg.toLowerCase().includes('permission') ||
                               errorMsg.toLowerCase().includes('insufficient') ||
                               errorMsg.toLowerCase().includes('missing');
    
    if (isPermissionError) {
      console.log('ℹ️ Companies cannot be loaded (not authenticated yet) - showing login prompt');
      _showLoginRequiredMessage();
    } else {
      console.error('❌ Company load failed:', errorMsg);
      _showCompanyLoadError(errorMsg);
    }

  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    console.log('🧹 Running cleanup in finally block...');
    _forceCleanupAfterCompanyLoad();
  }
}

async function _loadCompaniesInternal() {
  console.log('📡 Querying Firestore for companies...');

  if (typeof CompanyDB === 'undefined' || typeof CompanyDB.getAll !== 'function') {
    console.warn('⚠️ CompanyDB not available, skipping company load');
    _showCompanyDBUnavailable();
    return;
  }

  if (typeof APP_CONFIG !== 'undefined' && !APP_CONFIG.features.multiCompany) {
    console.log('ℹ️ Multi-company mode disabled');
    return;
  }

  var companyContainer = document.getElementById('loginCompanyGrid') ||
    document.getElementById('companySelectArea') ||
    document.getElementById('companyListLogin');

  if (!companyContainer) {
    console.warn('⚠️ Company container not found');
    return;
  }

  _showCompanyLoadingState(companyContainer);

  let companies;
  try {
    companies = await CompanyDB.getAll();
    console.log('📦 Found ' + companies.length + ' companies');
  } catch (queryError) {
    const queryErrorMsg = queryError.message || queryError.toString() || '';
    
    if (queryErrorMsg.toLowerCase().includes('permission') ||
        queryErrorMsg.toLowerCase().includes('insufficient') ||
        queryErrorMsg.toLowerCase().includes('missing')) {
      
      console.log('⚠️ Permission denied when querying companies (user may not be logged in)');
      throw new Error('PERMISSION_DENIED: ' + queryErrorMsg);
    }
    
    throw queryError;
  }

  if (!companies || companies.length === 0) {
    _showEmptyCompaniesState(companyContainer);
    return;
  }

  _renderCompaniesList(companies, companyContainer);
}

// ==========================================
// 🎨 UI State Functions for Company Grid
// ==========================================

function _showCompanyLoadingState(container) {
  container.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:28px;color:#94a3b8">
      <div style="width:36px;height:36px;border:3px solid rgba(99,102,241,.25);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 14px"></div>
      <p style="font-size:13px">Memuat daftar perusahaan...</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  `;
  container.style.display = 'grid';
}

function _showLoginRequiredMessage() {
  var companyContainer = document.getElementById('loginCompanyGrid') ||
    document.getElementById('companySelectArea') ||
    document.getElementById('companyListLogin');

  if (companyContainer) {
    companyContainer.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:32px;color:#94a3b8;background:rgba(99,102,241,0.05);border-radius:12px;border:1px dashed rgba(99,102,241,0.2)">
        <div style="font-size:42px;margin-bottom:12px">🔐</div>
        <p style="font-size:15px;font-weight:600;color:#c7d2fe;margin-bottom:6px">Login Terlebih Dahulu</p>
        <p style="font-size:12px;opacity:.8;line-height:1.6;margin-bottom:4px">
          Daftar perusahaan akan muncul setelah Anda login.
        </p>
        <p style="font-size:11px;opacity:.6;line-height:1.5">
          Atau tambahkan perusahaan pertama setelah login via menu <strong>"⚙️ Perusahaan"</strong>
        </p>
      </div>
    `;
    companyContainer.style.display = 'grid';
  }
}

function _showCompanyLoadError(errorMessage) {
  var companyContainer = document.getElementById('loginCompanyGrid') ||
    document.getElementById('companySelectArea') ||
    document.getElementById('companyListLogin');

  if (companyContainer) {
    companyContainer.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:28px;color:#fca5a8;background:rgba(239,68,68,0.05);border-radius:12px;border:1px dashed rgba(239,68,68,0.2)">
        <div style="font-size:42px;margin-bottom:12px">⚠️</div>
        <p style="font-size:15px;font-weight:600;color:#fca5a8;margin-bottom:6px">Gagal Memuat Perusahaan</p>
        <p style="font-size:12px;opacity:.8;line-height:1.6;margin-bottom:4px">
          ${errorMessage || 'Terjadi kesalahan saat memuat data'}
        </p>
        <p style="font-size:11px;opacity:.6;line-height:1.5">
          Silakan refresh halaman atau coba lagi nanti.
        </p>
      </div>
    `;
    companyContainer.style.display = 'grid';
  }

  if (typeof Toast !== 'undefined' && !errorMessage.toLowerCase().includes('permission')) {
    Toast.warning('Gagal memuat perusahaan. Coba refresh.');
  }
}

function _showEmptyCompaniesState(container) {
  container.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:32px;color:#94a3b8">
      <div style="font-size:48px;margin-bottom:12px">🏢</div>
      <p style="font-size:16px;font-weight:600;margin-bottom:6px">Belum Ada Perusahaan</p>
      <p style="font-size:12px;opacity:.7;line-height:1.6">
        Login terlebih dahulu, lalu buat perusahaan pertama melalui menu <strong>"Perusahaan"</strong>.
      </p>
    </div>
  `;
}

function _showCompanyDBUnavailable() {
  var companyContainer = document.getElementById('loginCompanyGrid');
  if (companyContainer) {
    companyContainer.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:28px;color:#94a3b8">
        <div style="font-size:42px;margin-bottom:12px">📦</div>
        <p style="font-size:14px;font-weight:600;margin-bottom:4px">Modul Perusahaan Belum Siap</p>
        <p style="font-size:11px;opacity:.7;line-height:1.5">
          Silakan refresh halaman atau hubungi admin.
        </p>
      </div>
    `;
    companyContainer.style.display = 'grid';
  }
}

function _renderCompaniesList(companies, container) {
  container.innerHTML = companies.map(function(comp) {
    var safeName = (typeof StringUtils !== 'undefined' && StringUtils.escapeHtml)
      ? StringUtils.escapeHtml(comp.name)
      : comp.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    var safeId = comp.id.replace(/'/g, "\\'");
    var safeIcon = (comp.icon || '🏢').replace(/'/g, "\\'");
    var safeColor = (comp.color || '#6366f1').replace(/'/g, "\\'");

    return `<div class="comp-card" id="companyCard_${safeId}" onclick="selectCompany('${safeId}','${safeName}','${safeIcon}','${safeColor}')" title="Klik untuk memilih: ${safeName}" style="cursor:pointer"><span class="ico">${safeIcon}</span><span class="nm">${safeName}</span><span class="fn">${comp.code || ''}</span></div>`;
  }).join('');

  if (typeof StorageUtils !== 'undefined') {
    try {
      var saved = StorageUtils.get('financesync_selectedCompany');
      if (saved && saved.id) {
        var card = document.getElementById('companyCard_' + saved.id);
        if (card) card.classList.add('picked');
      }
    } catch (e) {
      console.warn('⚠️ Could not restore selection:', e);
    }
  }
}

function _forceCleanupAfterCompanyLoad() {
  setTimeout(function() {
    var loader = document.getElementById('appLoader');
    
    if (loader && loader.style.display !== 'none' && loader.style.opacity !== '0') {
      console.log('⚡ Force hiding loader');

      if (typeof LoadingManager !== 'undefined') {
        LoadingManager.hide();
      }

      loader.style.transition = 'opacity 0.4s ease';
      loader.style.opacity = '0';
      setTimeout(function() {
        if (loader) loader.style.display = 'none';
      }, 400);
    }

    var user = typeof getCurrentUser === 'function'
      ? getCurrentUser()
      : (firebaseAuth ? firebaseAuth.currentUser : null);

    if (!user) {
      var scrLogin = document.getElementById('scrLogin');
      if (scrLogin && scrLogin.style.display === 'none') {
        scrLogin.style.display = '';
        var scrDash = document.getElementById('scrDash');
        if (scrDash) scrDash.style.display = 'none';
      }
    }
  }, 300);
}

// ==========================================
// 🔄 Retry Initialization
// ==========================================

async function retryFirebaseInit() {
  var retryBtn = document.getElementById('appRetryBtn');

  if (retryBtn) {
    retryBtn.disabled = true;
    retryBtn.textContent = '⏳ Mencoba menghubungkan...';
  }

  initRetryCount = 0;
  isFirebaseReady = false;
  isAuthListenerSetup = false;
  isBootstrapping = false;

  if (retryBtn) retryBtn.style.display = 'none';

  var loader = document.getElementById('appLoader');
  if (loader) {
    loader.style.display = 'flex';
    loader.style.opacity = '1';
  }

  var success = await initializeFirebase();

  if (success) {
    setupAuthListener(
      async function() {
        console.log('✅ Auto sign-in after retry');
        if (typeof loadInitialData === 'function') {
          await loadInitialData().catch(function(e) {
            console.warn('⚠️', e);
          });
        }
      },
      function() {
        console.log('👋 Signed out after retry');
      }
    );
  } else {
    if (retryBtn) {
      retryBtn.disabled = false;
      retryBtn.textContent = '🔄 Coba Hubungkan Ulang';
      retryBtn.style.display = 'block';
    }
  }
}

// ==========================================
// 🚀 Bootstrap / Entry Point
// ==========================================

async function bootstrapApp() {
  if (isBootstrapping) {
    console.warn('⚠️ Bootstrap already in progress');
    return;
  }

  isBootstrapping = true;

  console.log('%c🚀 Bootstrapping FinanceSync Pro...', 'color: #6366f1; font-size: 14px; font-weight: bold;');

  try {
    if (window.setLoaderProgress) {
      window.setLoaderProgress(1, '✅ Konfigurasi dimuat');
    } else if (typeof LoadingManager !== 'undefined') {
      LoadingManager.updateMessage('✅ Konfigurasi dimuat');
    }

    var firebaseInitialized = await initializeFirebase();

    if (firebaseInitialized) {
      console.log('👂 Setting up auth listener...');

      setupAuthListener(
        async function(user) {
          console.log('🎉 Welcome back!', user.email);
          
          if (typeof initializeDriveSync === 'function') {
            try {
              await initializeDriveSync();
              console.log('✅ Google Drive initialized after login');
            } catch (driveError) {
              console.warn('⚠️ Google Drive init failed (non-critical):', driveError);
            }
          }
          
          if (typeof loadInitialData === 'function') {
            await loadInitialData().catch(function(err) {
              console.warn('⚠️', err);
            });
          }
        },
        function() {
          console.log('👋 Goodbye!');
        }
      );

      console.log('✅ Bootstrap completed successfully');

    } else {
      console.error('❌ Firebase initialization failed');
    }

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);

    if (typeof LoadingManager !== 'undefined') {
      LoadingManager.updateMessage('❌ Gagal memulai aplikasi');
      LoadingManager.showError();
    }

    if (typeof Toast !== 'undefined') {
      Toast.error('Gagal memulai aplikasi. Silakan refresh.');
    }

    setTimeout(function() {
      hideLoaderAndShowScreen(false);
    }, 2000);

  } finally {
    setTimeout(function() {
      isBootstrapping = false;
    }, 1000);
  }
}

// ==========================================
// 🎯 Public API
// ==========================================

function getFirebaseAuth() { return firebaseAuth; }
function getFirestore() { return firebaseDb; }
function getCurrentUser() { return firebaseAuth ? firebaseAuth.currentUser : null; }
function isLoggedIn() { return firebaseAuth ? !!firebaseAuth.currentUser : false; }

async function getIdToken() {
  if (!firebaseAuth || !firebaseAuth.currentUser) return null;
  try {
    return await firebaseAuth.currentUser.getIdToken();
  } catch (e) {
    console.error('❌ getIdToken error:', e);
    return null;
  }
}

// ==========================================
// 📦 Exports
// ==========================================

window.initializeFirebase = initializeFirebase;
window.setupAuthListener = setupAuthListener;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.retryFirebaseInit = retryFirebaseInit;
window.bootstrapApp = bootstrapApp;

window.showLoginScreen = showLoginScreen;
window.showDashboard = showDashboard;
window.updateHeaderAuth = updateHeaderAuth;
window.updateConnectionStatus = updateConnectionStatus;

window.loadCompaniesForLogin = loadCompaniesForLogin;

window.getFirebaseAuth = getFirebaseAuth;
window.getFirestore = getFirestore;
window.getCurrentUser = getCurrentUser;
window.isLoggedIn = isLoggedIn;
window.getIdToken = getIdToken;

window.AuthManager = {
  getCurrentUser: getCurrentUser,
  isLoggedIn: isLoggedIn,
  onAuthStateChanged: function(callback) {
    if (firebaseAuth && typeof callback === 'function') {
      firebaseAuth.onAuthStateChanged(callback);
    }
  }
};

console.log('%c🔥 Firebase Init module loaded', 'color: #f59e0b; font-size: 11px;');
console.log('  • No more stuck at step 4');
console.log('  • Smart login (no-company allowed)');
console.log('  • First-time user auto-wizard');
console.log('  • Always hide loader in finally block');
console.log('  • ✅ Graceful permission error handling (v3.8.2)');
console.log('  • ✅ Google Drive init on login');
console.log('  • 🔧 SDK compatibility fix for doc.exists (v3.8.3)');
console.log('  • 🔧 Connection monitor improved - no false offline (v3.8.4)');
console.log('  • 🔧 Persistence DISABLED - write langsung ke server (v3.8.5)');

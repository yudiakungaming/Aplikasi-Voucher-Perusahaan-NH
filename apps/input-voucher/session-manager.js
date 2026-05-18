// js/session-manager.js
// Session Management untuk FinanceSync Pro v3.8.10

const SESSION_CONFIG = {
  ENABLE_SESSION_TIMEOUT: true,      // ✅ Aktifkan fitur timeout session
  TIMEOUT_HOURS: 4,                  // ⏰ Session expired setelah 4 jam tidak aktif
  SESSION_KEY: 'fs_session_v3',      // 🔑 Key untuk localStorage
  AUTO_LOGIN: false                  // ❌ Jangan auto-login walau Firebase masih auth
};

class SessionManager {
  constructor() {
    this.key = SESSION_CONFIG.SESSION_KEY;
    this.timeoutMs = SESSION_CONFIG.TIMEOUT_HOURS * 60 * 60 * 1000;
  }

  // ✅ Cek apakah session masih valid
  isValid() {
    if (!SESSION_CONFIG.ENABLE_SESSION_TIMEOUT) return true;
    
    const raw = localStorage.getItem(this.key);
    if (!raw) return false;
    
    try {
      const { userId, lastActivity, companyId } = JSON.parse(raw);
      const now = Date.now();
      
      // Expired?
      if (now - lastActivity > this.timeoutMs) {
        console.log('⏰ Session expired');
        return false;
      }
      return true;
    } catch (e) {
      console.error('Session parse error:', e);
      return false;
    }
  }

  // ✅ Set/update session setelah login sukses
  set(userId, companyId = null) {
    const data = {
      userId,
      companyId,
      lastActivity: Date.now(),
      createdAt: Date.now()
    };
    localStorage.setItem(this.key, JSON.stringify(data));
    console.log('🔐 Session created for user:', userId);
  }

  // ✅ Update timestamp aktivitas user
  refresh() {
    const raw = localStorage.getItem(this.key);
    if (!raw) return;
    
    try {
      const data = JSON.parse(raw);
      data.lastActivity = Date.now();
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to refresh session:', e);
    }
  }

  // ✅ Hapus session (logout)
  clear() {
    localStorage.removeItem(this.key);
    console.log('🗑️ Session cleared');
  }

  // ✅ Ambil data session
  getData() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }
}

const sessionManager = new SessionManager();

// 🎯 Track aktivitas user untuk refresh session
function setupActivityTracking() {
  if (!SESSION_CONFIG.ENABLE_SESSION_TIMEOUT) return;
  
  const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart', 'submit'];
  
  const handler = () => {
    // Debounce: update max 1x per 30 detik agar tidak terlalu sering
    if (!window._lastSessionRefresh || Date.now() - window._lastSessionRefresh > 30000) {
      sessionManager.refresh();
      window._lastSessionRefresh = Date.now();
    }
  };
  
  events.forEach(evt => {
    document.addEventListener(evt, handler, { passive: true });
  });
  
  // Juga refresh saat fokus kembali ke tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sessionManager.refresh();
    }
  });
}

// Export untuk digunakan di file lain
window.sessionManager = sessionManager;
window.setupActivityTracking = setupActivityTracking;
window.SESSION_CONFIG = SESSION_CONFIG;

console.log('%c🔐 Session Manager loaded', 'color: #8b5cf6; font-size: 11px;');
console.log(`  • Timeout: ${SESSION_CONFIG.TIMEOUT_HOURS} jam`);
console.log(`  • Auto-login: ${SESSION_CONFIG.AUTO_LOGIN ? 'ON' : 'OFF'}`);

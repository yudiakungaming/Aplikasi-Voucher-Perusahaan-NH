// js/session-manager.js

const SESSION_CONFIG = {
  ENABLE_SESSION_TIMEOUT: true,
  TIMEOUT_HOURS: 4,
  SESSION_KEY: 'fs_session_v3',
  AUTO_LOGIN: false
};

class SessionManager {
  constructor() {
    this.key = SESSION_CONFIG.SESSION_KEY;
    this.timeoutMs = SESSION_CONFIG.TIMEOUT_HOURS * 60 * 60 * 1000;
  }

  isValid() {
    if (!SESSION_CONFIG.ENABLE_SESSION_TIMEOUT) return true;
    
    const raw = localStorage.getItem(this.key);
    if (!raw) return false;
    
    try {
      const { userId, lastActivity, companyId } = JSON.parse(raw);
      const now = Date.now();
      
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

  clear() {
    localStorage.removeItem(this.key);
    console.log('🗑️ Session cleared');
  }

  getData() {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) : null;
  }
}

const sessionManager = new SessionManager();

function setupActivityTracking() {
  if (!SESSION_CONFIG.ENABLE_SESSION_TIMEOUT) return;
  
  const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart', 'submit'];
  
  const handler = () => {
    if (!window._lastSessionRefresh || Date.now() - window._lastSessionRefresh > 30000) {
      sessionManager.refresh();
      window._lastSessionRefresh = Date.now();
    }
  };
  
  events.forEach(evt => {
    document.addEventListener(evt, handler, { passive: true });
  });
  
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

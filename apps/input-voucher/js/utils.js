/**
 * ============================================
 * FinanceSync Pro v3.8.1 - Utility Functions (OPTIMIZED VERSION)
 * ============================================
 * 
 * File ini berisi fungsi-fungsi helper/utilitas yang digunakan
 * di seluruh aplikasi seperti:
 * - Format currency & dates
 * - Toast notifications
 * - Validation helpers
 * - File handling utilities
 * - Local storage management
 * - Loading screen manager
 * 
 * 🔗 Terhubung ke:
 *   - config.js (APP_CONFIG)
 *   - app.js (semua functions dipanggil dari sana)
 *   - firebase-init.js (data akan disimpan ke Firebase)
 * 
 * 📅 Dioptimasi: 08/05/2026
 */

// ==========================================
// 📅 Date & Time Utilities
// ==========================================

const DateUtils = {
  /**
   * Format tanggal ke format Indonesia
   * @param {Date|string} date - Tanggal yang akan diformat
   * @param {string} format - Format output (default: 'DD/MM/YYYY')
   * @returns {string} Tanggal yang sudah diformat
   */
  formatDate(date, format = 'DD/MM/YYYY') {
    if (!date) return '-';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  /**
   * Format tanggal ke format relatif (e.g., "2 jam yang lalu")
   * @param {Date|string} date 
   * @returns {string}
   */
  timeAgo(date) {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return `${diffSecs} detik lalu`;
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    
    return this.formatDate(date);
  },

  /**
   * Get tanggal hari ini dalam format YYYY-MM-DD (untuk input date)
   * @returns {string}
   * ✅ Dipakai di: app.js (line ~60) - set default date
   */
  getTodayISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Parse string date ke Date object
   * @param {string} dateStr 
   * @returns {Date|null}
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  },

  /**
   * Get timestamp ISO format
   * @returns {string}
   */
  getTimestampISO() {
    return new Date().toISOString();
  }
};

// ==========================================
// 💰 Currency Utilities
// ==========================================

const CurrencyUtils = {
  /**
   * Format angka ke format currency Rupiah
   * @param {number} amount - Jumlah uang
   * @returns {string} Format currency (e.g., "Rp 1.234.567")
   * ✅ Dipakai di: app.js generateDocumentPreview()
   */
  formatRupiah(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'Rp 0';
    }
    
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  /**
   * Parse currency string ke number
   * @param {string} currencyStr - String currency (e.g., "Rp 1.234.567")
   * @returns {number}
   */
  parseCurrency(currencyStr) {
    if (!currencyStr) return 0;
    const num = String(currencyStr).replace(/[^0-9,-]/g, '').replace(',', '.');
    return parseFloat(num) || 0;
  },

  /**
   * Format angka dengan pemisah ribuan
   * @param {number} num 
   * @returns {string}
   * ✅ Dipakai di: app.js calculateTotal()
   */
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
  }
};

// ==========================================
// 🔔 Toast Notification System
// ==========================================

const Toast = {
  container: null,
  _initialized: false,

  /**
   * Initialize toast container
   * ✅ Dipakai di: app.js DOMContentLoaded (line ~50)
   */
  init() {
    if (this._initialized) return; // Prevent double init
    
    this.container = document.getElementById('toastBox');
    if (!this.container) {
      // Auto-create container if not exists
      this.container = document.createElement('div');
      this.container.id = 'toastBox';
      this.container.className = 'toast-container';
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
      `;
      document.body.appendChild(this.container);
    }
    
    this._initialized = true;
    console.log('🔔 Toast system initialized');
  },

  /**
   * Show toast notification
   * @param {string} message - Pesan yang ditampilkan
   * @param {'success'|'error'|'warning'|'info'} type - Tipe toast
   * @param {number} duration - Durasi tampil (ms)
   */
  show(message, type = 'info', duration = null) {
    // Safety: ensure initialized
    if (!this._initialized) this.init();

    // Get duration from config or use default
    const toastDuration = duration || 
                          (typeof APP_CONFIG !== 'undefined' && APP_CONFIG?.settings?.toastDuration) || 
                          4000;

    const toast = document.createElement('div');
    
    // Style berdasarkan type
    const styles = {
      success: { bg: '#10b981', icon: '✅' },
      error: { bg: '#ef4444', icon: '❌' },
      warning: { bg: '#f59e0b', icon: '⚠️' },
      info: { bg: '#6366f1', icon: 'ℹ️' }
    };
    
    const style = styles[type] || styles.info;
    
    toast.style.cssText = `
      background: ${style.bg};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 100%;
    `;
    
    toast.innerHTML = `
      <span style="font-size: 16px; flex-shrink: 0;">${style.icon}</span>
      <span style="flex: 1; line-height: 1.4;">${this.escapeHtml(message)}</span>
    `;
    
    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });

    // Auto remove
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350);
    }, toastDuration);
  },

  /**
   * Escape HTML for safe display in toast
   * @param {string} str 
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  success(message, duration) {
    this.show(message, 'success', duration);
  },

  error(message, duration) {
    console.error('❌ Toast Error:', message); // Also log to console
    this.show(message, 'error', duration);
  },

  warning(message, duration) {
    this.show(message, 'warning', duration);
  },

  info(message, duration) {
    this.show(message, 'info', duration);
  }
};

// ==========================================
// ✅ Validation Helpers
// ==========================================

const Validator = {
  /**
   * Check if email is valid
   * @param {string} email 
   * @returns {boolean}
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  /**
   * Check if string is empty or whitespace only
   * @param {string} str 
   * @returns {boolean}
   */
  isEmpty(str) {
    return !str || String(str).trim().length === 0;
  },

  /**
   * Validate required fields in form
   * @param {HTMLElement} formElement 
   * @returns {boolean}
   * ✅ Dipakai di: app.js handleFormSubmit()
   */
  validateForm(formElement) {
    if (!formElement) {
      console.warn('⚠️ validateForm: formElement is null');
      return false;
    }

    let isValid = true;
    const requiredFields = formElement.querySelectorAll('[required]');
    
    if (requiredFields.length === 0) {
      console.log('ℹ️ No required fields found in form');
      return true;
    }
    
    requiredFields.forEach(field => {
      // Remove previous error styling
      field.style.borderColor = '';
      
      if (this.isEmpty(field.value)) {
        isValid = false;
        field.style.borderColor = '#ef4444';
        
        // Add shake animation
        field.style.animation = 'shake 0.3s ease-in-out';
        setTimeout(() => {
          if (field) field.style.animation = '';
        }, 300);

        // Focus first invalid field
        if (isValid === false && requiredFields[0] === field) {
          field.focus();
        }
      }
    });
    
    return isValid;
  },

  /**
   * Validate file size and type
   * @param {File} file 
   * @returns {{valid: boolean, error: string|null}}
   * ✅ Dipakai di: app.js handleFiles()
   */
  validateFile(file) {
    // Safety check for APP_CONFIG
    if (typeof APP_CONFIG === 'undefined') {
      console.warn('⚠️ APP_CONFIG not loaded, using default file validation');
      return { valid: true, error: null };
    }

    const maxFileSize = APP_CONFIG?.googleDrive?.maxFileSize || (30 * 1024 * 1024);
    const allowedTypes = APP_CONFIG?.googleDrive?.allowedTypes || ['.pdf', '.jpg', '.png'];

    // Check file size
    if (file.size > maxFileSize) {
      const maxSizeMB = (maxFileSize / (1024*1024)).toFixed(0);
      return {
        valid: false,
        error: `Ukuran file terlalu besar (maks ${maxSizeMB}MB)`
      };
    }

    // Check file extension
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return {
        valid: false,
        error: `Tipe file tidak diizinkan: ${ext}`
      };
    }

    return { valid: true, error: null };
  }
};

// ==========================================
// 📁 File Handling Utilities
// ==========================================

const FileUtils = {
  /**
   * Format file size ke human readable format
   * @param {number} bytes 
   * @returns {string}
   * ✅ Dipakai di: app.js renderSelectedFiles()
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Get file icon class based on extension
   * @param {string} filename 
   * @returns {string}
   * ✅ Dipakai di: app.js renderSelectedFiles()
   */
  getFileIcon(filename) {
    if (!filename) return 'default';
    
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      pdf: 'pdf',
      jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', webp: 'img', bmp: 'image',
      doc: 'doc', docx: 'doc',
      xls: 'xls', xlsx: 'xls',
      ppt: 'ppt', pptx: 'ppt'
    };
    return icons[ext] || 'default';
  },

  /**
   * Convert file to base64
   * @param {File} file 
   * @returns {Promise<string>}
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  /**
   * Create unique filename with timestamp
   * @param {string} originalName 
   * @returns {string}
   */
  createUniqueFilename(originalName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.split('.').pop();
    const name = originalName.replace(`.${ext}`, '');
    
    // Sanitize filename (remove special chars)
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    return `${sanitizedName}_${timestamp}_${random}.${ext}`;
  },

  /**
   * Get file extension from filename
   * @param {string} filename 
   * @returns {string}
   */
  getExtension(filename) {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  }
};

// ==========================================
// 🔤 String Utilities
// ==========================================

const StringUtils = {
  /**
   * Generate random ID
   * @param {number} length 
   * @returns {string}
   */
  generateId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generate invoice number
   * @param {string} prefix 
   * @returns {string}
   * ✅ Dipakai di: app.js gatherFormData()
   */
  generateInvoiceNumber(prefix = 'INV') {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return `${prefix}-${year}${month}${day}-${random}`;
  },

  /**
   * Truncate text with ellipsis
   * @param {string} text 
   * @param {number} maxLength 
   * @returns {string}
   */
  truncate(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Escape HTML to prevent XSS
   * @param {string} str 
   * @returns {string}
   * ✅ Dipakai di: app.js generateDocumentPreview(), renderSelectedFiles()
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  /**
   * Capitalize first letter
   * @param {string} str 
   * @returns {string}
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Convert string to slug (URL-friendly)
   * @param {string} str 
   * @returns {string}
   */
  slugify(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};

// ==========================================
// 🎨 DOM Utilities
// ==========================================

const DOMUtils = {
  /**
   * Shorthand for querySelector
   * @param {string} selector 
   * @param {HTMLElement} parent 
   * @returns {HTMLElement|null}
   */
  $(selector, parent = document) {
    return parent.querySelector(selector);
  },

  /**
   * Shorthand for querySelectorAll
   * @param {string} selector 
   * @param {HTMLElement} parent 
   * @returns {NodeList}
   */
  $$(selector, parent = document) {
    return parent.querySelectorAll(selector);
  },

  /**
   * Add event listener with delegation
   * @param {HTMLElement} parent 
   * @param {string} eventType 
   * @param {string} selector 
   * @param {Function} handler 
   */
  delegate(parent, eventType, selector, handler) {
    parent.addEventListener(eventType, function(event) {
      const target = event.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, event);
      }
    });
  },

  /**
   * Show element
   * @param {HTMLElement} el 
   */
  show(el) {
    if (el) el.style.display = '';
  },

  /**
   * Hide element
   * @param {HTMLElement} el 
   */
  hide(el) {
    if (el) el.style.display = 'none';
  },

  /**
   * Toggle element visibility
   * @param {HTMLElement} el 
   */
  toggle(el) {
    if (el) {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  },

  /**
   * Check if element is visible
   * @param {HTMLElement} el 
   * @returns {boolean}
   */
  isVisible(el) {
    if (!el) return false;
    return el.style.display !== 'none' && el.offsetParent !== null;
  }
};

// ==========================================
// 💾 Local Storage Utilities
// ==========================================

const StorageUtils = {
  /**
   * Prefix untuk semua keys (agar tidak conflict dengan apps lain)
   */
  PREFIX: 'financesync_',

  /**
   * Save data to localStorage
   * @param {string} key 
   * @param {*} value 
   * ✅ Dipakai di: app.js selectCompany(), dll
   */
  set(key, value) {
    try {
      const fullKey = key.startsWith(this.PREFIX) ? key : `${this.PREFIX}${key}`;
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
      Toast.error('Gagal menyimpan data lokal');
    }
  },

  /**
   * Get data from localStorage
   * @param {string} key 
   * @param {*} defaultValue 
   * @returns {*}
   * ✅ Dipakai di: app.js doLogin(), updateAuthUI(), dll
   */
  get(key, defaultValue = null) {
    try {
      const fullKey = key.startsWith(this.PREFIX) ? key : `${this.PREFIX}${key}`;
      const item = localStorage.getItem(fullKey);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('❌ Error reading from localStorage:', error);
      return defaultValue;
    }
  },

  /**
   * Remove data from localStorage
   * @param {string} key 
   */
  remove(key) {
    try {
      const fullKey = key.startsWith(this.PREFIX) ? key : `${this.PREFIX}${key}`;
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.error('❌ Error removing from localStorage:', error);
    }
  },

  /**
   * Clear all app data from localStorage
   * ✅ Dipakai saat: logout, reset app
   */
  clear() {
    try {
      const keysToRemove = [];
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ Cleared ${keysToRemove.length} items from localStorage`);
    } catch (error) {
      console.error('❌ Error clearing localStorage:', error);
    }
  },

  /**
   * Check if key exists
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    const fullKey = key.startsWith(this.PREFIX) ? key : `${this.PREFIX}${key}`;
    return localStorage.getItem(fullKey) !== null;
  },

  /**
   * Get all app data (for debugging/export)
   * @returns {Object}
   */
  getAll() {
    const data = {};
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.PREFIX)) {
        const shortKey = key.replace(this.PREFIX, '');
        try {
          data[shortKey] = JSON.parse(localStorage.getItem(key));
        } catch (e) {
          data[shortKey] = localStorage.getItem(key);
        }
      }
    });
    return data;
  }
};

// ==========================================
// 📊 Data Transformation Utilities
// ==========================================

const DataUtils = {
  /**
   * Deep clone object
   * @param {*} obj 
   * @returns {*}
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      console.warn('⚠️ Cannot deep clone object:', e);
      return obj;
    }
  },

  /**
   * Group array by key
   * @param {Array} arr 
   * @param {string} key 
   * @returns {Object}
   */
  groupBy(arr, key) {
    if (!Array.isArray(arr)) return {};
    return arr.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  /**
   * Sort array by key
   * @param {Array} arr 
   * @param {string} key 
   * @param {'asc'|'desc'} order 
   * @returns {Array}
   */
  sortBy(arr, key, order = 'asc') {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      
      // Handle null/undefined
      if (valA == null) return 1;
      if (valB == null) return -1;
      
      // Convert to same type for comparison
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });
  },

  /**
   * Filter array by search term
   * @param {Array} arr 
   * @param {string} searchTerm 
   * @param {string[]} keys 
   * @returns {Array}
   */
  search(arr, searchTerm, keys) {
    if (!Array.isArray(arr) || !searchTerm) return arr;
    
    const term = searchTerm.toLowerCase();
    return arr.filter(item => 
      keys.some(key => {
        const value = item[key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(term);
      })
    );
  },

  /**
   * Sum array of numbers
   * @param {Array} arr 
   * @param {string} key 
   * @returns {number}
   */
  sum(arr, key) {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((total, item) => total + (parseFloat(item[key]) || 0), 0);
  }
};

// ==========================================
// 🎯 App Loading Screen Manager (ENHANCED)
// ==========================================

const LoadingManager = {
  _loader: null,
  _text: null,
  _retryBtn: null,
  _isVisible: false,

  /**
   * Initialize loading manager (call once on DOM ready)
   */
  init() {
    this._loader = document.getElementById('appLoader');
    this._text = document.getElementById('appLoaderText');
    this._retryBtn = document.getElementById('appRetryBtn');
    
    if (this._retryBtn) {
      this._retryBtn.addEventListener('click', () => {
        console.log('🔄 Retry button clicked, reloading...');
        window.location.reload();
      });
    }
  },

  /**
   * Update loading screen message
   * @param {string} message 
   */
  updateMessage(message) {
    if (this._text) {
      this._text.textContent = message;
    }
    console.log(`⏳ Loading: ${message}`);
  },

  /**
   * Hide loading screen with fade out animation
   * ✅ Dipakai setelah: bootstrapApp selesai, data loaded
   */
  hide() {
    if (!this._loader || !this._isVisible) return;
    
    this._loader.style.opacity = '0';
    this._loader.style.transition = 'opacity 0.4s ease';
    
    setTimeout(() => {
      this._loader.style.display = 'none';
      this._isVisible = false;
      console.log('✅ Loading screen hidden');
    }, 400);
  },

  /**
   * Show loading screen
   */
  show() {
    if (!this._loader) {
      // Create loader if not exists
      this._createLoader();
    }
    
    this._loader.style.display = 'flex';
    this._loader.style.opacity = '1';
    this._isVisible = true;
  },

  /**
   * Show retry button on loading screen (when error occurs)
   */
  showError(message = 'Terjadi kesalahan. Silakan coba lagi.') {
    this.updateMessage(message);
    
    if (this._retryBtn) {
      this._retryBtn.style.display = 'block';
    }
    
    console.error('❌ Loading error shown');
  },

  /**
   * Hide retry button
   */
  hideError() {
    if (this._retryBtn) {
      this._retryBtn.style.display = 'none';
    }
  },

  /**
   * Create loader element dynamically (if not in HTML)
   * @private
   */
  _createLoader() {
    this._loader = document.createElement('div');
    this._loader.id = 'appLoader';
    this._loader.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 99998;
        transition: opacity 0.4s ease;
      ">
        <div style="
          width: 48px;
          height: 48px;
          border: 4px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        "></div>
        <div id="appLoaderText" style="
          color: #94a3b8;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          margin-bottom: 16px;
        ">Memuat aplikasi...</div>
        <button id="appRetryBtn" style="
          display: none;
          padding: 10px 24px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-family: inherit;
        ">🔄 Coba Lagi</button>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.prepend(this._loader);
    this._text = document.getElementById('appLoaderText');
    this._retryBtn = document.getElementById('appRetryBtn');
    
    if (this._retryBtn) {
      this._retryBtn.addEventListener('click', () => window.location.reload());
    }
  },

  /**
   * Check if loader is currently visible
   * @returns {boolean}
   */
  isVisible() {
    return this._isVisible;
  }
};

// ==========================================
// 🔗 Connection Status Monitor (NEW)
// ==========================================

const ConnectionMonitor = {
  _isOnline: navigator.onLine,

  init() {
    window.addEventListener('online', () => {
      this._isOnline = true;
      console.log('🌐 Back online');
      Toast.info('Koneksi internet kembali tersedia');
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      console.log('📴 Gone offline');
      Toast.warning('Anda offline. Beberapa fitur mungkin tidak tersedia.');
    });
  },

  isOnline() {
    return this._isOnline && navigator.onLine;
  }
};

// ==========================================
// 📦 Export Utilities to Global Scope
// ==========================================

window.DateUtils = DateUtils;
window.CurrencyUtils = CurrencyUtils;
window.Toast = Toast;
window.Validator = Validator;
window.FileUtils = FileUtils;
window.StringUtils = StringUtils;
window.DOMUtils = DOMUtils;
window.StorageUtils = StorageUtils;
window.DataUtils = DataUtils;
window.LoadingManager = LoadingManager;
window.ConnectionMonitor = ConnectionMonitor;

// Helper alias untuk backward compatibility
function updateAppLoadingMessage(message) {
  LoadingManager.updateMessage(message);
}

window.updateAppLoadingMessage = updateAppLoadingMessage;

// Auto-init connection monitor
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ConnectionMonitor.init());
} else {
  ConnectionMonitor.init();
}

console.log('%c📦 Utils module loaded successfully', 'color: #10b981; font-size: 11px;');
console.log('%c🔗 Ready to connect with Firebase via firebase-init.js', 'color: #f59e0b; font-size: 10px;');

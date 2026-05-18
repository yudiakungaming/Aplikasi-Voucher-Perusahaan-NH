/**
 * ============================================
 * FinanceSync Pro v3.8.1 - Google Drive & Sheets Sync
 * ============================================
 * 
 * ✅ IMPLEMENTASI REAL - Google Drive API v3
 * 
 * Fitur:
 * - OAuth 2.0 authentication via Google Identity Services
 * - Upload file ke Google Drive (folder spesifik)
 * - Auto-set permission "anyone with link"
 * - Delete file dari Drive
 * - Progress tracking & error handling
 * 
 * Dependencies:
 * - gapi (Google API Client Library) → loaded in index.html
 * - google.accounts.oauth2 (Google Identity Services) → loaded in index.html
 * - APP_CONFIG.googleDrive (credentials from config.js)
 * - Toast, Validator, FileUtils, LoadingManager (from utils.js)
 */

// ==========================================
// 🌐 Google Drive Sync State
// ==========================================

const DriveSync = {
  // Initialization status
  isInitialized: false,
  isLoading: false,
  
  // OAuth tokens
  accessToken: null,
  tokenClient: null,
  
  // gapi client status
  gapiLoaded: false,
  gisLoaded: false,
  
  // Track uploaded files in current session
  uploadedFiles: [],
  
  // Current upload progress
  uploadProgress: {
    isUploading: false,
    currentFile: null,
    progress: 0,
    totalFiles: 0,
    completedFiles: 0
  },
  
  // Token expiry tracking
  tokenExpiryTime: null
};

// ==========================================
// 🔄 INITIALIZATION FUNCTIONS
// ==========================================

/**
 * Initialize Google Drive integration
 * Called after both gapi and GIS libraries are loaded
 */
async function initializeDriveSync() {
  if (DriveSync.isInitialized || DriveSync.isLoading) {
    console.log('⚠️ Drive Sync already initializing or initialized');
    return;
  }

  try {
    DriveSync.isLoading = true;
    
    console.log('%c🔗 Initializing Google Drive Sync...', 'color: #3b82f6; font-size: 13px; font-weight: bold;');
    
    // Check if feature is enabled
    if (!APP_CONFIG.features.googleDriveUpload) {
      console.warn('⚠️ Google Drive upload feature is disabled in config');
      DriveSync.isLoading = false;
      return;
    }

    // Validate required configuration
    const driveConfig = APP_CONFIG.googleDrive;
    if (!driveConfig.clientId || !driveConfig.apiKey || !driveConfig.folderId) {
      throw new Error('Google Drive configuration incomplete. Check clientId, apiKey, and folderId in config.js');
    }

    console.log('📋 Configuration validated:');
    console.log(`   Client ID: ${driveConfig.clientId.substring(0, 20)}...`);
    console.log(`   Folder ID: ${driveConfig.folderId}`);
    console.log(`   Scopes: ${driveConfig.scopes}`);

    // Wait for gapi and GIS to be loaded (with timeout)
    await waitForGoogleLibraries();

    // Load the Drive API client library
    await loadDriveApiClient();

    // Setup OAuth token client (GIS)
    setupTokenClient();

    DriveSync.isInitialized = true;
    DriveSync.isLoading = false;

    console.log('%c✅ Google Drive Sync Initialized Successfully!', 'color: #22c55e; font-size: 13px; font-weight: bold;');
    
    Toast.success('Google Drive siap digunakan');

  } catch (error) {
    DriveSync.isLoading = false;
    DriveSync.isInitialized = false;
    
    console.error('❌ Failed to initialize Google Drive:', error);
    Toast.error(`Gagal init Google Drive: ${error.message}`);
    
    throw error;
  }
}

/**
 * Wait for gapi and GIS libraries to be loaded
 * @param {number} timeout - Max wait time in ms (default: 10s)
 */
function waitForGoogleLibraries(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkLibraries = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > timeout) {
        reject(new Error('Timeout waiting for Google API libraries to load'));
        return;
      }

      // Check if gapi is available
      if (typeof gapi !== 'undefined') {
        DriveSync.gapiLoaded = true;
        console.log('✅ gapi loaded');
      }
      
      // Check if Google Identity Services is available
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        DriveSync.gisLoaded = true;
        console.log('✅ Google Identity Services loaded');
      }
      
      // Both libraries ready?
      if (DriveSync.gapiLoaded && DriveSync.gisLoaded) {
        resolve();
        return;
      }
      
      // Check again after 100ms
      setTimeout(checkLibraries, 100);
    };
    
    checkLibraries();
  });
}

/**
 * Load Google Drive API v3 client
 */
function loadDriveApiClient() {
  return new Promise((resolve, reject) => {
    try {
      gapi.load('client', {
        callback: async () => {
          try {
            await gapi.client.init({
              apiKey: APP_CONFIG.googleDrive.apiKey,
              discoveryDocs: APP_CONFIG.googleDrive.discoveryDocs
            });
            
            console.log('✅ Google Drive API client loaded');
            resolve();
          } catch (err) {
            reject(new Error('Failed to initialize Drive API client: ' + err.message));
          }
        },
        onerror: () => {
          reject(new Error('Failed to load gapi.client'));
        },
        timeout: 5000,
        ontimeout: () => {
          reject(new Error('Timeout loading gapi.client'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Setup OAuth 2.0 Token Client using Google Identity Services
 */
function setupTokenClient() {
  try {
    DriveSync.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: APP_CONFIG.googleDrive.clientId,
      scope: APP_CONFIG.googleDrive.scopes,
      callback: '', // Will be set dynamically when requesting token
      prompt: 'consent',
      error_callback: (error) => {
        console.error('❌ OAuth error:', error);
        Toast.error('OAuth error: ' + (error.message || 'Unknown error'));
      }
    });
    
    console.log('✅ Token client configured');
  } catch (error) {
    throw new Error('Failed to setup token client: ' + error.message);
  }
}

// ==========================================
// 🔐 AUTHENTICATION & TOKEN MANAGEMENT
// ==========================================

/**
 * Request OAuth token from user (shows popup)
 * @returns {Promise<string>} Access token
 */
function requestAccessToken() {
  return new Promise((resolve, reject) => {
    if (!DriveSync.tokenClient) {
      reject(new Error('Token client not initialized. Call initializeDriveSync() first.'));
      return;
    }

    // Check if we have a valid token that's not expired
    if (DriveSync.accessToken && DriveSync.tokenExpiryTime && Date.now() < DriveSync.tokenExpiryTime) {
      console.log('♻️ Reusing existing access token');
      resolve(DriveSync.accessToken);
      return;
    }

    console.log('🔑 Requesting user consent...');

    // Set callback for this specific request
    DriveSync.tokenClient.callback = (response) => {
      if (response.error) {
        console.error('❌ Token request failed:', response);
        reject(new Error(response.error_description || response.error || 'Token request failed'));
        return;
      }

      DriveSync.accessToken = response.access_token;
      
      // Estimate token expiry (usually 1 hour, but we'll use 50 min to be safe)
      DriveSync.tokenExpiryTime = Date.now() + (50 * 60 * 1000);

      console.log('✅ Access token received');
      resolve(DriveSync.accessToken);
    };

    // Request the token (this will show popup if needed)
    DriveSync.tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Revoke OAuth token (logout from Google)
 */
function revokeAccessToken() {
  return new Promise((resolve) => {
    if (DriveSync.accessToken) {
      google.accounts.oauth2.revoke(DriveSync.accessToken, () => {
        console.log('🔒 Access token revoked');
        DriveSync.accessToken = null;
        DriveSync.tokenExpiryTime = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Check if user has valid Google auth
 * @returns {boolean}
 */
function isGoogleAuthenticated() {
  return !!(DriveSync.accessToken && DriveSync.tokenExpiryTime && Date.now() < DriveSync.tokenExpiryTime);
}

// ==========================================
// 📤 FILE UPLOAD FUNCTIONS
// ==========================================

/**
 * Upload single file to Google Drive
 * @param {File} file - File object from input element
 * @param {Object} options - Upload options
 * @param {string} [options.folderId] - Target folder ID (defaults to config)
 * @param {string} [options.description] - File description
 * @param {Function} [options.onProgress] - Progress callback (0-100)
 * @returns {Promise<Object>} Uploaded file metadata from Drive API
 */
async function uploadFileToDrive(file, options = {}) {
  try {
    // Validate file
    const validation = Validator.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    console.log(`📤 Uploading file: ${file.name} (${FileUtils.formatFileSize(file.size)})`);

    // Show initial progress
    showUploadProgress(file.name, 0);

    // Ensure we have a valid token
    const token = await requestAccessToken();

    // Get target folder ID
    const folderId = options.folderId || APP_CONFIG.googleDrive.folderId;

    // Create metadata for the file
    const metadata = {
      name: file.name,
      parents: [folderId]
    };

    if (options.description) {
      metadata.description = options.description;
    }

    // Perform the upload using fetch API with resumable upload for large files
    const result = await uploadWithFetch(token, file, metadata, options.onProgress);

    // Set permission to "anyone with link can view"
    if (APP_CONFIG.googleDrive.autoPermission === 'anyone') {
      await setFilePublicPermission(result.id, token);
    }

    // Build the final result object with all needed links
    const finalResult = {
      id: result.id,
      name: result.name,
      size: result.size || file.size,
      mimeType: result.mimeType || file.type,
      webViewLink: result.webViewLink,
      webContentLink: result.webContentLink,
      iconLink: result.iconLink || getDriveIconLink(result.mimeType || file.type),
      createdTime: result.createdTime,
      modifiedTime: result.modifiedTime,
      md5Checksum: result.md5Checksum
    };

    // Add to uploaded files tracking
    DriveSync.uploadedFiles.push({
      ...finalResult,
      localFile: file
    });

    // Show completion
    showUploadProgress(file.name, 100);

    console.log(`✅ File uploaded successfully: ${file.name}`);
    console.log(`   File ID: ${result.id}`);
    console.log(`   View Link: ${result.webViewLink}`);

    Toast.success(`File "${file.name}" berhasil diupload ke Drive`);

    return finalResult;

  } catch (error) {
    console.error(`❌ Error uploading ${file.name}:`, error);
    
    hideUploadProgress();
    
    // Provide user-friendly error message
    let errorMessage = error.message;
    if (error.message.includes('token')) {
      errorMessage = 'Gagal autentikasi dengan Google. Silakan coba lagi.';
    } else if (error.message.includes('permission') || error.message.includes('403')) {
      errorMessage = 'Tidak memiliki izin akses ke Google Drive.';
    } else if (error.message.includes('quota') || error.message.includes('404')) {
      errorMessage = 'Folder target tidak ditemukan atau quota penuh.';
    }
    
    Toast.error(`Gagal upload "${file.name}": ${errorMessage}`);
    
    throw error;
  }
}

/**
 * Upload file using Fetch API with progress tracking
 * Uses multipart upload for simplicity (good for files up to 30MB)
 * @private
 */
async function uploadWithFetch(token, file, metadata, onProgressCallback) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Construct the multipart upload body
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    // Metadata part
    const metadataPart = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    // File data part
    const filePart = 
      delimiter +
      'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';

    // Combine parts (we'll send file as ArrayBuffer)
    const preBody = metadataPart + filePart;
    const postBody = closeDelim;

    // Convert strings to byte arrays
    const encoder = new TextEncoder();
    const preBytes = encoder.encode(preBody);
    const postBytes = encoder.encode(postBody);

    // Total size calculation
    const totalSize = preBytes.length + file.size + postBytes.length;

    // Open XHR request
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,webViewLink,webContentLink,iconLink,createdTime,modifiedTime,md5Checksum');
    
    // Set headers
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'multipart/related; boundary=' + boundary);

    // Progress tracking
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        
        // Update UI progress bar
        showUploadProgress(file.name, percentComplete);
        
        // Call custom callback if provided
        if (typeof onProgressCallback === 'function') {
          onProgressCallback(percentComplete);
        }
      }
    };

    // Handle response
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (parseError) {
          reject(new Error('Invalid response from Drive API'));
        }
      } else {
        let errorMsg = `Upload failed with status ${xhr.status}`;
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          errorMsg = errorResponse.error?.message || errorMsg;
        } catch (e) {
          // Ignore parse error for error response
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = function() {
      reject(new Error('Network error during upload'));
    };

    xhr.ontimeout = function() {
      reject(new Error('Upload timeout'));
    };

    // Set timeout (5 minutes for large files)
    xhr.timeout = 5 * 60 * 1000;

    // Send the request with file data
    // We need to manually construct the body as ArrayBuffer
    const body = new Uint8Array(totalSize);
    body.set(preBytes, 0);
    
    // Read file as ArrayBuffer and copy it into the body
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileBytes = new Uint8Array(e.target.result);
      body.set(fileBytes, preBytes.length);
      body.set(postBytes, preBytes.length + fileBytes.length);
      
      xhr.send(body.buffer);
    };
    reader.onerror = function() {
      reject(new Error('Failed to read file'));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Set file permission to "anyone with link can read"
 * @private
 */
async function setFilePublicPermission(fileId, token) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=id,type,role,emailAddress`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('⚠️ Could not set public permission:', errorData.error?.message || response.statusText);
      // Don't throw - permission failure shouldn't break the upload
    } else {
      console.log(`🔓 Public permission set for file ${fileId}`);
    }
  } catch (error) {
    console.warn('⚠️ Error setting public permission:', error.message);
    // Non-critical error, don't throw
  }
}

/**
 * Upload multiple files to Google Drive
 * @param {FileList|Array<File>} files - Files to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} Array of uploaded file metadata
 */
async function uploadMultipleFiles(files, options = {}) {
  try {
    const fileArray = Array.from(files);
    
    if (fileArray.length === 0) {
      throw new Error('Tidak ada file yang dipilih');
    }

    console.log(`📦 Uploading ${fileArray.length} files...`);

    // Update global progress state
    DriveSync.uploadProgress.isUploading = true;
    DriveSync.uploadProgress.totalFiles = fileArray.length;
    DriveSync.uploadProgress.completedFiles = 0;

    // Upload files sequentially (more reliable than parallel)
    const results = [];
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      DriveSync.uploadProgress.currentFile = file.name;
      
      const result = await uploadFileToDrive(file, options);
      results.push(result);
      
      DriveSync.uploadProgress.completedFiles++;
      DriveSync.uploadProgress.progress = Math.round(
        (DriveSync.uploadProgress.completedFiles / DriveSync.uploadProgress.totalFiles) * 100
      );
    }

    // Reset progress state
    DriveSync.uploadProgress.isUploading = false;
    DriveSync.uploadProgress.progress = 100;

    console.log(`✅ All ${results.length} files uploaded successfully`);
    
    Toast.success(`${results.length} file berhasil diupload ke Google Drive!`);
    
    return results;
    
  } catch (error) {
    DriveSync.uploadProgress.isUploading = false;
    throw error;
  }
}

// ==========================================
// 🗑️ FILE DELETE FUNCTION
// ==========================================

/**
 * Delete file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<boolean>}
 */
async function deleteFileFromDrive(fileId) {
  try {
    if (!fileId || fileId.startsWith('mock_')) {
      console.log('⏭️ Skipping mock file deletion');
      return true;
    }

    console.log(`🗑️ Deleting file from Drive: ${fileId}`);

    // Ensure we have token
    const token = await requestAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    // Drive API returns 204 No Content on success
    if (response.status === 204 || response.ok) {
      // Remove from local tracking
      DriveSync.uploadedFiles = DriveSync.uploadedFiles.filter(f => f.id !== fileId);

      console.log(`✅ File deleted from Drive: ${fileId}`);
      Toast.success('File berhasil dihapus dari Google Drive');
      
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Delete failed with status ${response.status}`);
    }
    
  } catch (error) {
    console.error(`❌ Error deleting file ${fileId}:`, error);
    Toast.error('Gagal menghapus file dari Drive: ' + error.message);
    throw error;
  }
}

// ==========================================
// 📑 GOOGLE SHEETS SYNC (TEMPLATE - FUTURE FEATURE)
// ==========================================

/**
 * Sync submission data to Google Sheets
 * NOTE: This feature is disabled by default (googleSheetsSync: false)
 * Implement when Google Sheets API is fully configured
 */
async function syncToGoogleSheets(submissionData) {
  try {
    if (!APP_CONFIG.features.googleSheetsSync) {
      console.log('⏭️ Google Sheets sync disabled (feature flag off)');
      return { synced: false, reason: 'disabled' };
    }

    if (!APP_CONFIG.googleSheets.spreadsheetId) {
      console.log('⏭️ Google Sheets spreadsheet ID not configured');
      return { synced: false, reason: 'no_spreadsheet' };
    }

    console.log('📊 Syncing data to Google Sheets...');

    // TODO: Implement actual Sheets API calls when feature is enabled
    // For now, simulate success
    await new Promise(resolve => setTimeout(resolve, 300));

    const mockResult = {
      spreadsheetId: APP_CONFIG.googleSheets.spreadsheetId,
      sheetName: APP_CONFIG.googleSheets.sheets.main,
      range: `A${Date.now()}`,
      rowCount: 1,
      updated: new Date().toISOString(),
      synced: true
    };

    console.log('✅ Data synced to Google Sheets (simulated):', mockResult);
    
    return mockResult;
    
  } catch (error) {
    console.error('❌ Error syncing to Google Sheets:', error);
    
    // Don't throw - sync failure shouldn't break main flow
    Toast.warning('Data tersimpan tapi gagal sync ke Google Sheets');
    
    return { synced: false, error: error.message };
  }
}

/**
 * Sync company data to Google Sheets (template)
 */
async function syncCompanyToSheets(companyData) {
  try {
    if (!APP_CONFIG.features.googleSheetsSync) {
      return { synced: false, reason: 'disabled' };
    }

    console.log('🏢 Syncing company data to Google Sheets...');
    
    // TODO: Implement when feature enabled
    await new Promise(resolve => setTimeout(resolve, 200));

    return { synced: true };
    
  } catch (error) {
    console.error('❌ Error syncing company:', error);
    return { synced: false, error: error.message };
  }
}

/**
 * Export all submissions to Google Sheets (template)
 */
async function exportAllToSheets(companyId = null) {
  try {
    console.log('📤 Exporting all data to Google Sheets...');

    // Get all submissions
    const submissions = await SubmissionDB.getAll(companyId ? { companyId } : {});

    if (submissions.length === 0) {
      throw new Error('Tidak ada data untuk di-export');
    }

    console.log(`✅ Prepared ${submissions.length} rows for export`);
    
    Toast.success(`${submissions.length} data siap di-export ke Google Sheets`);
    
    return { exportedCount: submissions.length, prepared: true };
    
  } catch (error) {
    console.error('❌ Error exporting to sheets:', error);
    Toast.error('Export ke Google Sheets gagal: ' + error.message);
    throw error;
  }
}

// ==========================================
// 🔧 HELPER FUNCTIONS
// ==========================================

/**
 * Prepare submission data for Google Sheets row format
 */
function prepareRowDataForSheets(data) {
  return [
    data.id || StringUtils.generateId(),
    DateUtils.formatDate(data.tanggal),
    data.lokasi || '',
    data.jenis || '',
    data.kode || '',
    data.noInvoice || '',
    data.status || '',
    JSON.stringify(data.items || []),
    data.totalNominal || 0,
    data.dibayarkanKepada || '',
    data.catatan || '',
    (data.files || []).map(f => f.webViewLink).join(', '),
    data.companyId || '',
    data.createdAt ? DateUtils.formatDate(data.createdAt) : '',
    data.updatedAt ? DateUtils.formatDate(data.updatedAt) : ''
  ];
}

/**
 * Get Google Drive icon URL based on MIME type
 */
function getDriveIconLink(mimeType) {
  const iconMap = {
    'application/pdf': 'https://drive-thirdparty.googleusercontent.com/16/type/application/pdf',
    'image/jpeg': 'https://drive-thirdparty.googleusercontent.com/16/type/image/jpeg',
    'image/png': 'https://drive-thirdparty.googleusercontent.com/16/type/image/png',
    'image/gif': 'https://drive-thirdparty.googleusercontent.com/16/type/image/gif',
    'image/webp': 'https://drive-thirdparty.googleusercontent.com/16/type/image/webp',
    'application/vnd.google-apps.document': 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet': 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.google-apps.spreadsheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'https://drive-thirdparty.googleusercontent.com/16/type/application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  return iconMap[mimeType] || 'https://drive-thirdparty.googleusercontent.com/16/type/application/octet-stream';
}

/**
 * Show upload progress in UI
 * @param {string} fileName - Name of file being uploaded
 * @param {number} percent - Progress percentage (0-100)
 */
function showUploadProgress(fileName, percent) {
  const upBarWrap = document.getElementById('upBarWrap');
  const upBarFill = document.getElementById('upBarFill');
  
  if (upBarWrap) {
    if (percent > 0 && percent < 100) {
      upBarWrap.style.display = 'block';
    } else if (percent >= 100) {
      // Hide after showing 100% briefly
      setTimeout(() => {
        if (upBarWrap) upBarWrap.style.display = 'none';
        if (upBarFill) upBarFill.style.width = '0%';
      }, 1500);
    }
  }
  
  if (upBarFill) {
    upBarFill.style.width = `${Math.min(percent, 100)}%`;
  }
}

/**
 * Hide upload progress UI immediately
 */
function hideUploadProgress() {
  const upBarWrap = document.getElementById('upBarWrap');
  const upBarFill = document.getElementById('upBarFill');
  
  if (upBarWrap) upBarWrap.style.display = 'none';
  if (upBarFill) upBarFill.style.width = '0%';
}

/**
 * Generate shareable view link for Drive file
 * @param {string} fileId - Google Drive file ID
 * @returns {string} Full URL to view the file
 */
function generateDriveShareLink(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Generate direct download link for Drive file
 * @param {string} fileId - Google Drive file ID
 * @returns {string} URL to download the file
 */
function generateDriveDownloadLink(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// ==========================================
// 🎯 PUBLIC API OBJECT
// ==========================================

const DriveAPI = {
  // Initialization
  init: initializeDriveSync,
  
  // Authentication
  isAuthenticated: isGoogleAuthenticated,
  requestToken: requestAccessToken,
  revokeToken: revokeAccessToken,
  
  // File operations
  uploadFile: uploadFileToDrive,
  uploadMultiple: uploadMultipleFiles,
  deleteFile: deleteFileFromDrive,
  
  // Sheets operations (template)
  syncSubmission: syncToGoogleSheets,
  syncCompany: syncCompanyToSheets,
  exportAll: exportAllToSheets,
  
  // Utilities
  getShareLink: generateDriveShareLink,
  getDownloadLink: generateDriveDownloadLink,
  
  // State accessors
  getState: () => ({ 
    isInitialized: DriveSync.isInitialized,
    isAuthenticated: isGoogleAuthenticated(),
    uploadedCount: DriveSync.uploadedFiles.length,
    progress: { ...DriveSync.uploadProgress }
  }),
  getUploadedFiles: () => [...DriveSync.uploadedFiles],
  clearUploadedFiles: () => { DriveSync.uploadedFiles = []; }
};

// ==========================================
// 📦 EXPORT TO GLOBAL SCOPE
// ==========================================

window.DriveSync = DriveSync;
window.DriveAPI = DriveAPI;
window.initializeDriveSync = initializeDriveSync;
window.uploadFileToDrive = uploadFileToDrive;
window.uploadMultipleFiles = uploadMultipleFiles;
window.deleteFileFromDrive = deleteFileFromDrive;
window.syncToGoogleSheets = syncToGoogleSheets;
window.syncCompanyToSheets = syncCompanyToSheets;
window.exportAllToSheets = exportAllToSheets;
window.showUploadProgress = showUploadProgress;
window.hideUploadProgress = hideUploadProgress;
window.requestAccessToken = requestAccessToken;
window.revokeAccessToken = revokeAccessToken;
window.isGoogleAuthenticated = isGoogleAuthenticated;

console.log('%c🔗 Drive Sync module loaded (REAL IMPLEMENTATION)', 'color: #22c55e; font-size: 13px; font-weight: bold;');
console.log('%c✅ Ready for Google Drive uploads', 'color: #3b82f6; font-size: 11px;');

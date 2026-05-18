// ═══════════════════════════════════════════════════════
// FINANCE SYNC PRO - DASHBOARD SCRIPT (v4.3 - FINAL SYNC)
// ✅ FIX: Column "dibayarkanKepada" included in normalization
// ✅ Semua fitur + Charts, Pagination, PWA, Advanced Filters
// ═══════════════════════════════════════════════════════

// ===== KONFIGURASI =====
const BASE_URL = 'https://script.google.com/macros/s/AKfycbzkjnWUqXwGFnj5PgmGzO57WyGRy5aOIxe2xplW8mqoTc9x8A3rn-dTamLrKRJYlw/exec';
const APPS_SCRIPT_URL = () => `${BASE_URL}?action=getVouchers&_t=${Date.now()}`;
const SYNC_TRIGGER_URL = () => `${BASE_URL}?action=triggerSync&token=Yudi0201&_t=${Date.now()}`;

const COMPANY_FILTER_DEFAULT = 'all';
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;
const SYNC_COOLDOWN = 5 * 60 * 1000;
const CACHE_DURATION = 30000;
const DEFAULT_PAGE_SIZE = 50;

// ===== STATE =====
let allVouchers = [];
let filteredVouchers = [];
let paginatedVouchers = [];
let sortConfig = { key: 'tanggal', direction: 'desc' };
let autoRefreshTimer = null;
let isSyncing = false;
let lastFetchTime = 0;
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;
let totalPages = 1;
let charts = { status: null, company: null, trend: null };
let isOnline = navigator.onLine;
let cachedData = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initEventListeners();
    initPWA();
    await fetchData(true);
});

// ═══════════════════════════════════════════════════════
// 🌓 THEME (DARK MODE)
// ═══════════════════════════════════════════════════════
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.textContent = '☀️';
    }
    updateChartTheme();
}

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.textContent = isDark ? '🌓' : '☀️';
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        updateChartTheme();
        renderCharts(filteredVouchers);
    });
}

function updateChartTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = isDark ? '#a0a0a0' : '#666666';
        Chart.defaults.borderColor = isDark ? '#3a3a4e' : '#eeeeee';
    }
}

// ═══════════════════════════════════════════════════════
// 🔘 EVENT LISTENERS
// ═══════════════════════════════════════════════════════
function initEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            clearFilters();
            triggerManualSync();
        });
    }
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportToPDF);
    
    const autoRefresh = document.getElementById('autoRefresh');
    if (autoRefresh) {
        autoRefresh.addEventListener('change', (e) => toggleAutoRefresh(e.target.checked));
    }
    
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => { currentPage = 1; applyFilters(); }, 300);
        });
    }
    
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
        companyFilter.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    }
    
    document.querySelectorAll('.status-filter').forEach(cb => {
        cb.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    });
    
    const nominalMin = document.getElementById('nominalMin');
    const nominalMax = document.getElementById('nominalMax');
    if (nominalMin) nominalMin.addEventListener('input', () => { currentPage = 1; applyFilters(); });
    if (nominalMax) nominalMax.addEventListener('input', () => { currentPage = 1; applyFilters(); });
    
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) dateFrom.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    if (dateTo) dateTo.addEventListener('change', () => { currentPage = 1; applyFilters(); });
    
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            handleQuickPeriod(e.target.dataset.period);
        });
    });
    
    document.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]');
        if (th) toggleSort(th.dataset.sort);
    });
    
    const syncCloseBtn = document.getElementById('syncCloseBtn');
    if (syncCloseBtn) {
        syncCloseBtn.addEventListener('click', () => {
            document.getElementById('syncNotification').style.display = 'none';
        });
    }
    
    const manualSyncLink = document.getElementById('manualSyncLink');
    if (manualSyncLink) {
        manualSyncLink.addEventListener('click', (e) => {
            e.preventDefault();
            triggerManualSync();
        });
    }
    
    setupPaginationListeners();
    
    const pageSizeSelect = document.getElementById('pageSize');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            pageSize = e.target.value === 'all' ? Infinity : parseInt(e.target.value);
            currentPage = 1;
            applyPagination();
        });
    }
    
    window.addEventListener('online', () => {
        isOnline = true;
        updateOnlineStatus();
        if (cachedData) fetchData(true);
    });
    window.addEventListener('offline', () => {
        isOnline = false;
        updateOnlineStatus();
        showNotification('📴 Anda offline. Menampilkan data cache...', 'info');
    });
}

function setupPaginationListeners() {
    const buttons = [
        { id: 'firstPage', action: () => goToPage(1) },
        { id: 'prevPage', action: () => goToPage(currentPage - 1) },
        { id: 'nextPage', action: () => goToPage(currentPage + 1) },
        { id: 'lastPage', action: () => goToPage(totalPages) },
        { id: 'firstPageBottom', action: () => goToPage(1) },
        { id: 'prevPageBottom', action: () => goToPage(currentPage - 1) },
        { id: 'nextPageBottom', action: () => goToPage(currentPage + 1) },
        { id: 'lastPageBottom', action: () => goToPage(totalPages) }
    ];
    
    buttons.forEach(({ id, action }) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', action);
    });
}

function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    applyPagination();
    document.getElementById('tableContainer')?.scrollIntoView({ behavior: 'smooth' });
}

function handleQuickPeriod(period) {
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const customDateGroup = document.getElementById('customDateGroup');
    
    const today = new Date();
    let from, to;
    
    switch(period) {
        case 'today':
            from = to = today;
            customDateGroup?.classList.remove('active');
            break;
        case 'week':
            const dayOfWeek = today.getDay() || 7;
            from = new Date(today);
            from.setDate(today.getDate() - dayOfWeek + 1);
            to = today;
            customDateGroup?.classList.remove('active');
            break;
        case 'month':
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            to = today;
            customDateGroup?.classList.remove('active');
            break;
        case 'year':
            from = new Date(today.getFullYear(), 0, 1);
            to = today;
            customDateGroup?.classList.remove('active');
            break;
        case 'custom':
            customDateGroup?.classList.add('active');
            applyFilters();
            return;
    }
    
    if (dateFrom) dateFrom.valueAsDate = from;
    if (dateTo) dateTo.valueAsDate = to;
    currentPage = 1;
    applyFilters();
}

async function triggerManualSync() {
    const btn = document.getElementById('refreshBtn');
    const notif = document.getElementById('syncNotification');
    
    if (!btn || !notif || isSyncing) return;
    
    const lastSync = localStorage.getItem('lastManualSync');
    const now = Date.now();
    if (lastSync && (now - parseInt(lastSync)) < SYNC_COOLDOWN) {
        const remaining = Math.ceil((SYNC_COOLDOWN - (now - parseInt(lastSync))) / 1000);
        showNotification(`⏱️ Tunggu ${remaining} detik sebelum sync berikutnya`, 'info');
        return;
    }
    
    isSyncing = true;
    btn.disabled = true;
    btn.innerHTML = '⏳ Syncing...';
    showNotification('🔄 Memulai sinkronisasi... Mohon tunggu.', 'info');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        const response = await fetch(SYNC_TRIGGER_URL(), {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'triggerSync', token: 'Yudi0201', timestamp: new Date().toISOString() })
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        if (!result?.success) throw new Error(result?.message || 'Unknown error');
        
        showNotification('✅ Sinkronisasi selesai! Memuat data terbaru...', 'success');
        localStorage.setItem('lastManualSync', Date.now().toString());
        
        setTimeout(() => fetchData(true), 1500);
        
    } catch (error) {
        console.error('❌ Sync error:', error);
        let errorMsg = error.message;
        if (errorMsg.includes('Unauthorized')) errorMsg = 'Token tidak valid.';
        else if (errorMsg.includes('fetch') || errorMsg.includes('Network')) errorMsg = 'Gagal terhubung ke server.';
        showNotification(`❌ Gagal sync: ${errorMsg}`, 'error');
        setTimeout(() => fetchData(true), 1000);
        
    } finally {
        isSyncing = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Refresh Data'; }
        setTimeout(() => { if (notif) notif.style.display = 'none'; }, 6000);
    }
}

async function fetchData(force = false, retryCount = 0) {
    const now = Date.now();
    if (!force && now - lastFetchTime < CACHE_DURATION && allVouchers.length > 0) {
        applyFilters();
        return;
    }
    
    try {
        showLoading(true);
        showElements(['error', 'emptyState', 'tableContainer'], false);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(APPS_SCRIPT_URL(), {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        if (!result?.success) throw new Error(result?.message || 'Unknown error');
        
        allVouchers = normalizeData(result);
        lastFetchTime = now;
        
        if (isOnline) await cacheDataToIndexedDB(allVouchers);
        
        if (allVouchers.length === 0) {
            resetCompanyFilter();
            showEmptyState('⚠️ Tidak ada data voucher ditemukan');
            return;
        }
        
        populateCompanyFilter(allVouchers);
        initDateRange();
        currentPage = 1;
        applyFilters();
        updateLastSync();
        console.log(`✅ Loaded ${allVouchers.length} vouchers`);
        
    } catch (error) {
        console.error('❌ Fetch error:', error);
        
        if (!isOnline) {
            const cached = await getCachedDataFromIndexedDB();
            if (cached && cached.length > 0) {
                allVouchers = cached;
                populateCompanyFilter(allVouchers);
                applyFilters();
                showNotification('📴 Menampilkan data cache (offline mode)', 'info');
                return;
            }
        }
        
        if (retryCount < 3 && (error.message.includes('fetch') || error.message.includes('CORS'))) {
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return fetchData(force, retryCount + 1);
        }
        
        showError(`❌ Gagal mengambil data <br><small>${getFriendlyError(error.message)}</small>`);
    } finally {
        showLoading(false);
    }
}

async function initPWA() {
    updateOnlineStatus();
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
        } catch (err) {
            console.log('❌ Service Worker failed:', err);
        }
    }
}

function updateOnlineStatus() {
    isOnline = navigator.onLine;
    const badge = document.getElementById('offlineBadge');
    const cacheStatus = document.getElementById('cacheStatus');
    if (badge) badge.style.display = isOnline ? 'none' : 'inline';
    if (cacheStatus) cacheStatus.textContent = isOnline ? '💾 Cache: Aktif' : '📴 Offline Mode';
}

const DB_NAME = 'FinanceSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'vouchers';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function cacheDataToIndexedDB(data) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.clear();
        for (const item of data) {
            await store.put(item);
        }
    } catch (err) {
        console.error('❌ Failed to cache data:', err);
    }
}

async function getCachedDataFromIndexedDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve([]);
        });
    } catch (err) {
        return [];
    }
}

function populateCompanyFilter(vouchers) {
    const select = document.getElementById('companyFilter');
    if (!select) return;
    const currentSelection = select.value;
    select.innerHTML = '<option value="all">Semua</option>';
    const companies = [...new Set(
        vouchers.map(v => v.company).filter(c => c && String(c).trim() !== '').map(c => String(c).trim().toLowerCase())
    )].sort((a, b) => a.localeCompare(b));
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company.toUpperCase();
        select.appendChild(option);
    });
    if (currentSelection && currentSelection !== 'all') {
        const exists = Array.from(select.options).some(opt => opt.value === currentSelection.toLowerCase());
        if (exists) select.value = currentSelection.toLowerCase();
    }
}

function resetCompanyFilter() {
    const select = document.getElementById('companyFilter');
    if (select) { select.innerHTML = '<option value="all">Semua</option>'; select.value = 'all'; }
}

// ═══════════════════════════════════════════════════════
// 🔍 FILTER & SORT (FIXED FIELD)
// ═══════════════════════════════════════════════════════
function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const companyFilterEl = document.getElementById('companyFilter');
    const dateFromEl = document.getElementById('dateFrom');
    const dateToEl = document.getElementById('dateTo');
    
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const companyFilter = companyFilterEl?.value || COMPANY_FILTER_DEFAULT;
    const dateFrom = dateFromEl?.value;
    const dateTo = dateToEl?.value;
    
    const selectedStatuses = Array.from(document.querySelectorAll('.status-filter:checked')).map(cb => cb.value);
    const nominalMin = parseFloat(document.getElementById('nominalMin')?.value) || 0;
    const nominalMax = parseFloat(document.getElementById('nominalMax')?.value) || Infinity;
    
    filteredVouchers = allVouchers.filter(v => {
        if (companyFilter !== 'all' && v.company?.toLowerCase() !== companyFilter.toLowerCase()) return false;
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(v.status)) return false;
        const nominal = parseFloat(v.nominal) || 0;
        if (nominal < nominalMin || nominal > nominalMax) return false;
        if (searchTerm) {
            // MENAMBAHKAN v.dibayarkanKepada ke dalam pencarian
            const searchFields = [v.no_invoice, v.isi_invoice, v.lokasi, v.jenis, v.dibayarkanKepada, v.file_name]
                .filter(Boolean).join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }
        if (dateFrom && v.tanggal < dateFrom) return false;
        if (dateTo && v.tanggal > dateTo) return false;
        return true;
    });
    
    filteredVouchers.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        if (sortConfig.key === 'nominal') return (parseFloat(aVal) - parseFloat(bVal)) * modifier;
        if (sortConfig.key === 'tanggal') return (new Date(aVal) - new Date(bVal)) * modifier;
        return String(aVal).localeCompare(String(bVal)) * modifier;
    });
    
    updateStats(filteredVouchers);
    renderCharts(filteredVouchers);
    applyPagination();
    displayTable(paginatedVouchers);
    updateFilteredCount();
    updatePaginationControls();
}

function toggleSort(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = key === 'tanggal' ? 'desc' : 'asc';
    }
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortConfig.key) th.classList.add(`sort-${sortConfig.direction}`);
    });
    currentPage = 1;
    applyFilters();
}

function applyPagination() {
    if (pageSize === Infinity || pageSize >= filteredVouchers.length) {
        paginatedVouchers = [...filteredVouchers];
        totalPages = 1;
        currentPage = 1;
    } else {
        totalPages = Math.ceil(filteredVouchers.length / pageSize);
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        paginatedVouchers = filteredVouchers.slice(start, end);
    }
}

function updatePaginationControls() {
    const showPagination = filteredVouchers.length > pageSize && pageSize !== Infinity;
    document.getElementById('paginationTop')?.style.setProperty('display', showPagination ? 'flex' : 'none');
    document.getElementById('paginationBottom')?.style.setProperty('display', showPagination ? 'flex' : 'none');
    
    const info = `Menampilkan ${(currentPage-1)*pageSize+1}-${Math.min(currentPage*pageSize, filteredVouchers.length)} dari ${filteredVouchers.length} data`;
    const infoEl = document.getElementById('paginationInfo');
    const infoElBottom = document.getElementById('paginationInfoBottom');
    if (infoEl) infoEl.textContent = info;
    if (infoElBottom) infoElBottom.textContent = info;
    
    const updateBtns = (prefix) => {
        const first = document.getElementById(`${prefix}firstPage`);
        const prev = document.getElementById(`${prefix}prevPage`);
        const next = document.getElementById(`${prefix}nextPage`);
        const last = document.getElementById(`${prefix}lastPage`);
        if (first) first.disabled = currentPage === 1;
        if (prev) prev.disabled = currentPage === 1;
        if (next) next.disabled = currentPage === totalPages;
        if (last) last.disabled = currentPage === totalPages;
    };
    updateBtns('');
    updateBtns('');
}

function initDateRange() {
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const dateTo = document.getElementById('dateTo');
    const dateFrom = document.getElementById('dateFrom');
    if (dateTo && !dateTo.value) dateTo.valueAsDate = today;
    if (dateFrom && !dateFrom.value) dateFrom.valueAsDate = ninetyDaysAgo;
}

function updateStats(vouchers) {
    const total = vouchers.length;
    const totalNominal = vouchers.reduce((sum, v) => sum + (parseFloat(v.nominal) || 0), 0);
    const lunas = vouchers.filter(v => v.status === 'Lunas').reduce((sum, v) => sum + (parseFloat(v.nominal) || 0), 0);
    const belum = totalNominal - lunas;
    animateValue('totalVoucher', total);
    animateValue('totalNominal', totalNominal, true);
    animateValue('totalLunas', lunas, true);
    animateValue('totalBelum', belum, true);
}

function animateValue(elementId, value, isCurrency = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = isCurrency ? formatRupiah(value) : value.toLocaleString('id-ID');
}

function renderCharts(vouchers) {
    const chartsContainer = document.getElementById('chartsContainer');
    if (!chartsContainer) return;
    chartsContainer.style.display = vouchers.length > 0 ? 'grid' : 'none';
    if (vouchers.length === 0) { destroyCharts(); return; }
    destroyCharts();
    renderStatusChart(vouchers);
    renderCompanyChart(vouchers);
    renderTrendChart(vouchers);
}

function destroyCharts() {
    ['status', 'company', 'trend'].forEach(key => {
        if (charts[key]) { charts[key].destroy(); charts[key] = null; }
    });
}

function renderStatusChart(vouchers) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    const lunas = vouchers.filter(v => v.status === 'Lunas').length;
    const belum = vouchers.length - lunas;
    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Lunas', 'Belum Lunas'],
            datasets: [{ data: [lunas, belum], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Status Pembayaran', font: { size: 14, weight: 'bold' } },
                legend: { position: 'bottom', labels: { padding: 15 } }
            }
        }
    });
}

function renderCompanyChart(vouchers) {
    const ctx = document.getElementById('companyChart');
    if (!ctx) return;
    const companyMap = {};
    vouchers.forEach(v => { const c = v.company || 'Unknown'; companyMap[c] = (companyMap[c] || 0) + 1; });
    charts.company = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(companyMap).map(c => c.toUpperCase()),
            datasets: [{ label: 'Jumlah Voucher', data: Object.values(companyMap), backgroundColor: '#667eea', borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Voucher per Perusahaan', font: { size: 14, weight: 'bold' } },
                legend: { display: false }
            },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderTrendChart(vouchers) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    const monthlyData = {};
    vouchers.forEach(v => {
        const date = new Date(v.tanggal);
        const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        if (!monthlyData[key]) monthlyData[key] = { count: 0, nominal: 0 };
        monthlyData[key].count += 1;
        monthlyData[key].nominal += parseFloat(v.nominal) || 0;
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths.map(m => { const [y, mo] = m.split('-'); return `${monthNames[parseInt(mo)-1]} ${y}`; }),
            datasets: [
                { label: 'Jumlah Voucher', data: sortedMonths.map(m => monthlyData[m].count), borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)', fill: true, tension: 0.4 },
                { label: 'Total Nominal (Juta Rp)', data: sortedMonths.map(m => (monthlyData[m].nominal / 1000000).toFixed(1)), borderColor: '#f093fb', backgroundColor: 'rgba(240,147,251,0.1)', fill: true, tension: 0.4, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: { display: true, text: 'Tren Voucher per Bulan', font: { size: 14, weight: 'bold' } },
                legend: { position: 'bottom', labels: { padding: 15 } }
            },
            scales: {
                y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Jumlah Voucher' } },
                y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Total Nominal (Juta Rp)' }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════
// 📋 TABLE (FIXED KEY)
// ═══════════════════════════════════════════════════════
function displayTable(vouchers) {
    const container = document.getElementById('tableContainer');
    if (!container) return;
    if (vouchers.length === 0) { showEmptyState('🔍 Tidak ada data yang sesuai filter'); return; }
    
    // DEFINISI KOLOM - Memastikan dibayarkanKepada ada di index yang benar
    const columns = [
        { key: 'tanggal', label: 'Tanggal', sortable: true },
        { key: 'no_invoice', label: 'No Invoice', sortable: true },
        { key: 'company', label: 'Company', sortable: true },
        { key: 'jenis', label: 'Jenis' },
        { key: 'lokasi', label: 'Lokasi' },
        { key: 'isi_invoice', label: 'Keterangan' },
        { key: 'nominal', label: 'Nominal', format: 'currency', sortable: true },
        { key: 'status', label: 'Status' },
        { key: 'dibayarkanKepada', label: 'Dibayarkan' }, 
        { key: 'file_url', label: 'File', format: 'link' }
    ];
    
    const headerHTML = columns.map(col => `<th ${col.sortable ? `data-sort="${col.key}"` : ''}>${col.label}</th>`).join('');
    const rowsHTML = vouchers.map(row => `
        <tr>
            ${columns.map(col => {
                let value = row[col.key] ?? '-';
                if (col.format === 'currency' && value !== '-' && value !== '') value = formatRupiah(value);
                if (col.format === 'link' && value?.startsWith('http')) {
                    const label = row.file_name || 'Lihat File';
                    value = `<a href="${escapeHtml(value)}" target="_blank" rel="noopener" class="file-link">${escapeHtml(label)}</a>`;
                }
                if (col.key === 'status') {
                    const cls = value === 'Lunas' ? 'status-lunas' : ['Belum', 'Belum Lunas'].includes(value) ? 'status-belum' : 'status-other';
                    value = `<span class="status-badge ${cls}">${escapeHtml(value)}</span>`;
                }
                return `<td>${value ?? '-'}</td>`;
            }).join('')}
        </tr>
    `).join('');
    
    container.innerHTML = `
        <div style="overflow-x:auto">
        <table class="data-table">
            <thead><tr>${headerHTML}</tr></thead>
            <tbody>${rowsHTML}</tbody>
        </table>
        </div>
        <p class="table-footer">
            ${paginatedVouchers.length} dari ${filteredVouchers.length} data • Halaman ${currentPage}/${totalPages} • Update: ${new Date().toLocaleString('id-ID')}
        </p>
    `;
    container.style.display = 'block';
}

function exportToCSV() {
    if (filteredVouchers.length === 0) { alert('Tidak ada data untuk di-export'); return; }
    const columns = ['tanggal', 'no_invoice', 'company', 'jenis', 'lokasi', 'isi_invoice', 'nominal', 'status', 'dibayarkanKepada', 'file_url'];
    const headers = ['Tanggal', 'No Invoice', 'Company', 'Jenis', 'Lokasi', 'Keterangan', 'Nominal', 'Status', 'Dibayarkan', 'Link File'];
    let csv = headers.join(',') + '\n';
    filteredVouchers.forEach(row => {
        const values = columns.map(col => {
            let val = row[col] ?? '';
            if (col === 'nominal') val = parseFloat(val) || 0;
            if (String(val).includes(',') || String(val).includes('"')) val = `"${String(val).replace(/"/g, '""')}"`;
            return val;
        });
        csv += values.join(',') + '\n';
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voucher-export-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function exportToPDF() {
    if (filteredVouchers.length === 0) { alert('Tidak ada data untuk di-export'); return; }
    if (typeof window.jspdf === 'undefined') { alert('Library PDF belum loaded'); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    doc.setFontSize(16);
    doc.setTextColor(31, 78, 120);
    doc.text('FinanceSync Pro - Laporan Voucher', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')} • Total: ${filteredVouchers.length} voucher`, 14, 28);
    
    const tableData = filteredVouchers.map(v => [
        v.tanggal, v.no_invoice, (v.company || '').toUpperCase(), v.jenis, v.lokasi, 
        formatRupiah(v.nominal), v.status, v.dibayarkanKepada || '-'
    ]);
    
    doc.autoTable({
        head: [['Tanggal', 'Invoice', 'Company', 'Jenis', 'Lokasi', 'Nominal', 'Status', 'Dibayarkan']],
        body: tableData,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [31, 78, 120], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 5: { halign: 'right' }, 6: { cellWidth: 25 } }
    });
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Halaman ${i} dari ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }
    
    doc.save(`voucher-laporan-${new Date().toISOString().slice(0,10)}.pdf`);
}

function toggleAutoRefresh(enabled) {
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
    if (enabled) {
        autoRefreshTimer = setInterval(() => fetchData(false), AUTO_REFRESH_INTERVAL);
    }
}

// ═══════════════════════════════════════════════════════
// ⚙️ DATA NORMALIZATION (FIXED)
// ═══════════════════════════════════════════════════════
function normalizeData(response) {
    let raw = [];
    if (Array.isArray(response)) raw = response;
    else if (response?.success && Array.isArray(response.data)) raw = response.data;
    else if (response?.data && Array.isArray(response.data)) raw = response.data;
    
    return raw.map(item => ({
        ...item,
        // MEMASTIKAN PROPERTI INI TETAP ADA
        dibayarkanKepada: item.dibayarkanKepada || '-',
        company: item.company ? String(item.company).trim().toLowerCase() : '',
        nominal: String(item.nominal || '').replace(/[^0-9.-]/g, '') || '0',
        status: item.status ? String(item.status).trim() : 'Belum'
    }));
}

function formatRupiah(angka) {
    if (typeof angka !== 'number') angka = parseFloat(angka) || 0;
    return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

function escapeHtml(text) {
    if (!text) return '-';
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function getFriendlyError(msg) {
    if (msg.includes('fetch') || msg.includes('Network')) return 'Tidak bisa terhubung ke server.';
    return msg;
}

function showLoading(show) { const el = document.getElementById('loading'); if (el) el.style.display = show ? 'block' : 'none'; }
function showError(msg) { const el = document.getElementById('error'); if (el) { el.innerHTML = msg; el.style.display = 'block'; } }
function showEmptyState(msg) { 
    const el = document.getElementById('emptyState');
    if (el) { const p = el.querySelector('p'); if (p) p.textContent = msg; el.style.display = 'block'; }
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) tableContainer.style.display = 'none';
}
function showElements(ids, show) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; }); }
function updateFilteredCount() { const el = document.getElementById('filteredCount'); if (el) el.textContent = `${filteredVouchers.length} data`; }
function updateLastSync() { const el = document.getElementById('lastSync'); if (el) el.textContent = new Date().toLocaleString('id-ID'); }

function showNotification(message, type = 'info') {
    const notif = document.getElementById('syncNotification');
    const msgEl = document.getElementById('syncMessage');
    if (!notif || !msgEl) return;
    msgEl.textContent = message;
    notif.className = `sync-notification ${type}`;
    notif.style.display = 'flex';
    setTimeout(() => { notif.style.display = 'none'; }, 6000);
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const companyFilter = document.getElementById('companyFilter');
    if (searchInput) searchInput.value = '';
    if (companyFilter) companyFilter.value = COMPANY_FILTER_DEFAULT;
    document.querySelectorAll('.status-filter').forEach(cb => cb.checked = true);
    const nominalMin = document.getElementById('nominalMin');
    const nominalMax = document.getElementById('nominalMax');
    if (nominalMin) nominalMin.value = '';
    if (nominalMax) nominalMax.value = '';
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.period-btn[data-period="month"]')?.classList.add('active');
    initDateRange();
    currentPage = 1;
    applyFilters();
}

window.clearFilters = clearFilters;
window.refreshData = () => fetchData(true);
window.forceReload = () => { localStorage.removeItem('theme'); window.location.reload(true); };

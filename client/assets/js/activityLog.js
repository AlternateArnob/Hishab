/* ============================================================
   HISHAB ERP — activityLog.js
   Tracks all API calls with Activity ID, Name, Timestamp, API
   ============================================================ */

const ActivityLog = (() => {
  const STORAGE_KEY = 'hishab_activity_log';
  const MAX_ENTRIES = 200;

  // Human-readable names for API paths
  const activityNames = {
    // Auth
    'POST /api/auth/login':              'User Login',
    'GET /api/auth/me':                  'Fetch Current User',
    'GET /api/auth/users':               'List Users',
    'POST /api/auth/register':           'Register User',
    'POST /api/auth/change-password':    'Change Password',

    // CRM
    'GET /api/crm/stats':                'Load CRM Stats',
    'GET /api/crm/customers':            'List Customers',
    'POST /api/crm/customers':           'Create Customer',

    // Inventory
    'GET /api/inventory/stats':          'Load Inventory Stats',
    'GET /api/inventory/categories':     'Load Categories',
    'GET /api/inventory/products':       'List Products',
    'POST /api/inventory/products':      'Create Product',

    // Sales
    'GET /api/sales/stats':              'Load Sales Stats',
    'GET /api/sales/orders':             'List Orders',
    'POST /api/sales/orders':            'Create Order',
    'GET /api/sales/invoices':           'List Invoices',

    // Accounting
    'GET /api/accounting/accounts':      'Load Accounts',
    'GET /api/accounting/transactions':  'Load Transactions',
    'POST /api/accounting/transactions': 'Create Transaction',
    'POST /api/accounting/payments':     'Record Payment',
    'GET /api/accounting/summary':       'Load Summary',

    // Analytics
    'GET /api/analytics/dashboard':         'Load Dashboard Analytics',
    'GET /api/analytics/sales-report':      'Load Sales Report',
    'GET /api/analytics/inventory-report':  'Load Inventory Report',
  };

  function resolveActivityName(method, path) {
    // Strip query strings and trailing slashes
    const cleanPath = path.split('?')[0].replace(/\/$/, '');
    const key = `${method} ${cleanPath}`;

    // Exact match
    if (activityNames[key]) return activityNames[key];

    // Pattern matching for dynamic paths
    if (/PATCH \/api\/auth\/users\/\d+\/role/.test(key))      return 'Update User Role';
    if (/PATCH \/api\/auth\/users\/\d+\/name/.test(key))      return 'Update User Name';
    if (/DELETE \/api\/auth\/users\/\d+/.test(key))           return 'Delete User';
    if (/PATCH \/api\/auth\/users\/\d+\/status/.test(key))    return 'Update User Status';
    if (/PATCH \/api\/auth\/users\/\d+\/password/.test(key))  return 'Reset User Password';

    if (/GET \/api\/crm\/customers\/\d+/.test(key))           return 'View Customer';
    if (/PUT \/api\/crm\/customers\/\d+/.test(key))           return 'Update Customer';
    if (/DELETE \/api\/crm\/customers\/\d+/.test(key))        return 'Delete Customer';
    if (/POST \/api\/crm\/customers\/\d+\/activities/.test(key)) return 'Log Customer Activity';

    if (/GET \/api\/inventory\/products\/\d+/.test(key))      return 'View Product';
    if (/PUT \/api\/inventory\/products\/\d+/.test(key))      return 'Update Product';
    if (/POST \/api\/inventory\/products\/\d+\/adjust/.test(key)) return 'Adjust Stock';

    if (/GET \/api\/sales\/orders\/\d+/.test(key))            return 'View Order';
    if (/PUT \/api\/sales\/orders\/\d+\/confirm/.test(key))   return 'Confirm Order';
    if (/PUT \/api\/sales\/orders\/\d+\/cancel/.test(key))    return 'Cancel Order';

    if (/GET \/api\/accounting\/transactions\/\d+/.test(key)) return 'View Transaction';

    return `${method} ${cleanPath}`;
  }

  function generateId() {
    return 'ACT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
  }

  function getLog() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  function saveLog(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function addEntry(method, path, status) {
    const entries = getLog();
    const entry = {
      id:        generateId(),
      name:      resolveActivityName(method, path),
      timestamp: new Date().toISOString(),
      api:       `${method} ${path.split('?')[0]}`,
      status,
    };
    entries.unshift(entry); // newest first
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    saveLog(entries);
    // update badge if panel already mounted
    _updateBadge();
    return entry;
  }

  function clearLog() {
    localStorage.removeItem(STORAGE_KEY);
    _updateBadge();
    _rerenderList();
  }

  // ── Badge helper ──
  function _updateBadge() {
    const badge = document.getElementById('activity-log-badge');
    if (!badge) return;
    const count = getLog().length;
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count === 0 ? 'none' : 'flex';
  }

  // ── Re-render list inside open panel ──
  function _rerenderList() {
    const list = document.getElementById('activity-log-list');
    if (!list) return;
    _renderEntries(list);
  }

  function _renderEntries(list) {
    const entries = getLog();
    if (entries.length === 0) {
      list.innerHTML = `
        <div class="al-empty">
          <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>No activity yet</p>
          <span>API calls will appear here</span>
        </div>`;
      return;
    }

    list.innerHTML = entries.map(e => {
      const d   = new Date(e.timestamp);
      const ts  = d.toLocaleString('en-BD', { month:'short', day:'numeric',
                    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
      const statusClass = e.status === 'success' ? 'al-status-ok' : 'al-status-err';
      const statusLabel = e.status === 'success' ? 'OK' : 'ERR';
      const method = e.api.split(' ')[0];
      const methodClass = `al-method-${method.toLowerCase()}`;
      return `
        <div class="al-entry">
          <div class="al-entry-top">
            <span class="al-entry-id">${e.id}</span>
            <span class="al-status ${statusClass}">${statusLabel}</span>
          </div>
          <div class="al-entry-name">${e.name}</div>
          <div class="al-entry-meta">
            <span class="al-method ${methodClass}">${method}</span>
            <span class="al-entry-api">${e.api.split(' ').slice(1).join(' ')}</span>
          </div>
          <div class="al-entry-ts">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            ${ts}
          </div>
        </div>`;
    }).join('');
  }

  // ── Mount panel into DOM ──
  function mountPanel() {
    if (document.getElementById('activity-log-panel')) return;

    const overlay = document.createElement('div');
    overlay.id = 'activity-log-overlay';
    overlay.className = 'al-overlay';
    overlay.onclick = closePanel;

    const panel = document.createElement('div');
    panel.id = 'activity-log-panel';
    panel.className = 'al-panel';
    panel.innerHTML = `
      <div class="al-header">
        <div class="al-header-left">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <span>Activity Log</span>
        </div>
        <div class="al-header-right">
          <button class="al-clear-btn" onclick="ActivityLog.clear()" title="Clear log">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Clear Log
          </button>
          <button class="al-close-btn" onclick="ActivityLog.closePanel()" title="Close">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="al-list" id="activity-log-list"></div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    _renderEntries(document.getElementById('activity-log-list'));
  }

  function openPanel() {
    mountPanel();
    requestAnimationFrame(() => {
      document.getElementById('activity-log-overlay').classList.add('show');
      document.getElementById('activity-log-panel').classList.add('open');
    });
  }

  function closePanel() {
    const panel   = document.getElementById('activity-log-panel');
    const overlay = document.getElementById('activity-log-overlay');
    if (!panel) return;
    panel.classList.remove('open');
    overlay.classList.remove('show');
  }

  function clear() {
    clearLog();
  }

  // ── Inject topbar button (call after DOM ready) ──
  function injectButton() {
    const actions = document.querySelector('.topbar-actions');
    if (!actions || document.getElementById('activity-log-btn')) return;

    const btn = document.createElement('button');
    btn.id        = 'activity-log-btn';
    btn.className = 'al-topbar-btn';
    btn.title     = 'Activity Log';
    btn.onclick   = openPanel;
    btn.innerHTML = `
      <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
      </svg>
      <span id="activity-log-badge" class="al-badge" style="display:none">0</span>`;

    actions.prepend(btn);
    _updateBadge();
  }

  return { addEntry, getLog, clearLog: clear, clear, openPanel, closePanel, injectButton, _updateBadge };
})();

// Auto-inject button when DOM is ready
document.addEventListener('DOMContentLoaded', () => ActivityLog.injectButton());

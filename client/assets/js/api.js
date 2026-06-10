/* ============================================================
   HISHAB ERP — api.js
   Centralized fetch wrapper — attaches JWT, handles errors
   ============================================================ */

const BASE = window.location.origin;

async function request(method, path, body = null) {
  const token = localStorage.getItem('hishab_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let status = 'success';
  try {
    const res = await fetch(`${BASE}${path}`, opts);

    if (res.status === 401) {
      status = 'error';
      if (typeof ActivityLog !== 'undefined') ActivityLog.addEntry(method, path, status);
      localStorage.removeItem('hishab_token');
      localStorage.removeItem('hishab_user');
      window.location.href = '/pages/login.html';
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      status = 'error';
      if (typeof ActivityLog !== 'undefined') ActivityLog.addEntry(method, path, status);
      throw new Error(data.message || 'Request failed');
    }

    if (typeof ActivityLog !== 'undefined') ActivityLog.addEntry(method, path, status);
    if (typeof ActivityTracker !== 'undefined') ActivityTracker.send(method, path, status);
    return data;
  } catch (err) {
    if (status === 'success') { // fetch-level error (network)
      if (typeof ActivityLog !== 'undefined') ActivityLog.addEntry(method, path, 'error');
      if (typeof ActivityTracker !== 'undefined') ActivityTracker.send(method, path, 'error');
    }
    throw err;
  }
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),

  // Auth
  login:          (email, password) => api.post('/api/auth/login', { email, password }),
  me:             ()                => api.get('/api/auth/me'),
  users:          ()                => api.get('/api/auth/users'),
  register:       (data)            => api.post('/api/auth/register', data),
  updateRole:     (id, role)        => api.patch(`/api/auth/users/${id}/role`, { role }),
  updateName:     (id, name)        => api.patch(`/api/auth/users/${id}/name`, { name }),
  deleteUser:     (id)              => api.delete(`/api/auth/users/${id}`),
  updateStatus:   (id, is_active)   => api.patch(`/api/auth/users/${id}/status`, { is_active }),
  changePassword: (current_password, new_password) => api.post('/api/auth/change-password', { current_password, new_password }),
  resetPassword:  (id, new_password)               => api.patch(`/api/auth/users/${id}/password`, { new_password }),

  // CRM
  crm: {
    stats:        ()         => api.get('/api/crm/stats'),
    list:         (q = '')   => api.get(`/api/crm/customers${q}`),
    get:          (id)       => api.get(`/api/crm/customers/${id}`),
    create:       (data)     => api.post('/api/crm/customers', data),
    update:       (id, data) => api.put(`/api/crm/customers/${id}`, data),
    delete:       (id)       => api.delete(`/api/crm/customers/${id}`),
    addActivity:  (id, data) => api.post(`/api/crm/customers/${id}/activities`, data),
  },

  // Inventory
  inventory: {
    stats:      ()           => api.get('/api/inventory/stats'),
    categories: ()           => api.get('/api/inventory/categories'),
    list:       (q = '')     => api.get(`/api/inventory/products${q}`),
    get:        (id)         => api.get(`/api/inventory/products/${id}`),
    create:     (data)       => api.post('/api/inventory/products', data),
    update:     (id, data)   => api.put(`/api/inventory/products/${id}`, data),
    adjust:     (id, data)   => api.post(`/api/inventory/products/${id}/adjust`, data),
  },

  // Sales
  sales: {
    stats:    ()         => api.get('/api/sales/stats'),
    list:     (q = '')   => api.get(`/api/sales/orders${q}`),
    get:      (id)       => api.get(`/api/sales/orders/${id}`),
    create:   (data)     => api.post('/api/sales/orders', data),
    confirm:  (id)       => api.put(`/api/sales/orders/${id}/confirm`),
    cancel:   (id)       => api.put(`/api/sales/orders/${id}/cancel`),
    invoices: (q = '')   => api.get(`/api/sales/invoices${q}`),
  },

  // Accounting
  accounting: {
    accounts:      ()        => api.get('/api/accounting/accounts'),
    transactions:  (q = '')  => api.get(`/api/accounting/transactions${q}`),
    createTx:      (data)    => api.post('/api/accounting/transactions', data),
    recordPayment: (data)    => api.post('/api/accounting/payments', data),
    summary:       (q = '')  => api.get(`/api/accounting/summary${q}`),
  },

  // Analytics
  analytics: {
    dashboard:       ()       => api.get('/api/analytics/dashboard'),
    salesReport:     (q = '') => api.get(`/api/analytics/sales-report${q}`),
    inventoryReport: ()       => api.get('/api/analytics/inventory-report'),
    insights:        (q = '') => api.get(`/api/analytics/insights${q}`),
    track:           (data)   => api.post('/api/analytics/track', data),
    recalculate:     ()       => api.post('/api/analytics/insights/recalculate'),
  },
};

// ── Activity tracker: sends events to the server ──────────────
// Maps API method+path patterns to action_type and section
const ActivityTracker = (() => {
  const sectionMap = [
    [/\/api\/crm/,         'crm'],
    [/\/api\/sales/,       'sales'],
    [/\/api\/inventory/,   'inventory'],
    [/\/api\/accounting/,  'accounting'],
    [/\/api\/analytics/,   'analytics'],
    [/\/api\/auth/,        'users'],
  ];

  const actionMap = [
    ['GET',    'view'],
    ['POST',   'create'],
    ['PUT',    'edit'],
    ['PATCH',  'edit'],
    ['DELETE', 'delete'],
  ];

  // Skip tracking internal tracking calls to avoid infinite loops
  const skipPaths = ['/api/analytics/track', '/api/analytics/insights', '/api/auth/me'];

  function resolveSection(path) {
    for (const [pattern, section] of sectionMap) {
      if (pattern.test(path)) return section;
    }
    return 'other';
  }

  function resolveAction(method, path) {
    if (path.includes('/report') || path.includes('/dashboard')) return 'report';
    if (path.includes('/export')) return 'export';
    if (path.includes('/login'))  return 'login';
    for (const [m, action] of actionMap) {
      if (m === method) return action;
    }
    return 'view';
  }

  function send(method, path, status) {
    const cleanPath = path.split('?')[0];
    if (skipPaths.some(p => cleanPath.startsWith(p))) return;
    const token = localStorage.getItem('hishab_token');
    if (!token) return;
    // fire-and-forget, don't await
    fetch(`${BASE}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        action_type: resolveAction(method, cleanPath),
        section:     resolveSection(cleanPath),
        api_method:  method,
        api_path:    cleanPath,
        status:      status,
      })
    }).catch(() => {}); // silently ignore tracking errors
  }

  return { send };
})();
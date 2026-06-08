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

  const res = await fetch(`${BASE}${path}`, opts);

  // Token expired or invalid
  if (res.status === 401) {
    localStorage.removeItem('hishab_token');
    localStorage.removeItem('hishab_user');
    window.location.href = '/pages/login.html';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),

  // Auth
  login:    (email, password) => api.post('/api/auth/login', { email, password }),
  me:       ()                => api.get('/api/auth/me'),
  users:    ()                => api.get('/api/auth/users'),
  register: (data)            => api.post('/api/auth/register', data),

  // CRM
  crm: {
    stats:        ()        => api.get('/api/crm/stats'),
    list:         (q = '')  => api.get(`/api/crm/customers${q}`),
    get:          (id)      => api.get(`/api/crm/customers/${id}`),
    create:       (data)    => api.post('/api/crm/customers', data),
    update:       (id, data)=> api.put(`/api/crm/customers/${id}`, data),
    delete:       (id)      => api.delete(`/api/crm/customers/${id}`),
    addActivity:  (id, data)=> api.post(`/api/crm/customers/${id}/activities`, data),
  },

  // Inventory
  inventory: {
    stats:      ()          => api.get('/api/inventory/stats'),
    categories: ()          => api.get('/api/inventory/categories'),
    list:       (q = '')    => api.get(`/api/inventory/products${q}`),
    get:        (id)        => api.get(`/api/inventory/products/${id}`),
    create:     (data)      => api.post('/api/inventory/products', data),
    update:     (id, data)  => api.put(`/api/inventory/products/${id}`, data),
    adjust:     (id, data)  => api.post(`/api/inventory/products/${id}/adjust`, data),
  },

  // Sales
  sales: {
    stats:      ()          => api.get('/api/sales/stats'),
    list:       (q = '')    => api.get(`/api/sales/orders${q}`),
    get:        (id)        => api.get(`/api/sales/orders/${id}`),
    create:     (data)      => api.post('/api/sales/orders', data),
    confirm:    (id)        => api.put(`/api/sales/orders/${id}/confirm`),
    cancel:     (id)        => api.put(`/api/sales/orders/${id}/cancel`),
    invoices:   (q = '')    => api.get(`/api/sales/invoices${q}`),
  },

  // Accounting
  accounting: {
    accounts:       ()          => api.get('/api/accounting/accounts'),
    transactions:   (q = '')    => api.get(`/api/accounting/transactions${q}`),
    createTx:       (data)      => api.post('/api/accounting/transactions', data),
    recordPayment:  (data)      => api.post('/api/accounting/payments', data),
    summary:        (q = '')    => api.get(`/api/accounting/summary${q}`),
  },

  // Analytics
  analytics: {
    dashboard:        ()        => api.get('/api/analytics/dashboard'),
    salesReport:      (q = '')  => api.get(`/api/analytics/sales-report${q}`),
    inventoryReport:  ()        => api.get('/api/analytics/inventory-report'),
  },
};
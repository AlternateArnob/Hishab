/* ============================================================
   HISHAB ERP — ui.js
   Shared UI helpers: toast, modal, loader, confirm dialog
   ============================================================ */

// ── Toast ─────────────────────────────────────────────────────
function toast(message, type = 'default', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;

  const icons = {
    success: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
    default: `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  t.innerHTML = (icons[type] || icons.default) + `<span>${message}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateY(10px)';
    t.style.transition = 'all .2s ease';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(html, options = {}) {
  closeModal(); // close any existing
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal';

  const modal = document.createElement('div');
  modal.className = `modal${options.large ? ' modal-lg' : ''}`;
  modal.innerHTML = html;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Close on Escape
  document._modalKeyHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', document._modalKeyHandler);

  // Focus first input
  setTimeout(() => {
    const first = modal.querySelector('input, select, textarea');
    if (first) first.focus();
  }, 50);

  return modal;
}

function closeModal() {
  const m = document.getElementById('active-modal');
  if (m) m.remove();
  if (document._modalKeyHandler) {
    document.removeEventListener('keydown', document._modalKeyHandler);
    delete document._modalKeyHandler;
  }
}

// ── Confirm dialog ────────────────────────────────────────────
function confirmDialog(message, onConfirm, options = {}) {
  const html = `
    <div class="modal-header">
      <h2>${options.title || 'Confirm'}</h2>
      <button class="btn-icon" onclick="closeModal()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text)">${message}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn ${options.danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-btn">
        ${options.confirmText || 'Confirm'}
      </button>
    </div>`;
  openModal(html);
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// ── Loader (full page) ────────────────────────────────────────
function showLoader() {
  let el = document.getElementById('page-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'page-loader';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(248,250,252,.85);
      display:flex;align-items:center;justify-content:center;z-index:9000;
      backdrop-filter:blur(2px);`;
    el.innerHTML = `<div class="spinner" style="width:32px;height:32px;border-width:3px"></div>`;
    document.body.appendChild(el);
  }
}
function hideLoader() {
  const el = document.getElementById('page-loader');
  if (el) el.remove();
}

// ── Button loading state ──────────────────────────────────────
function btnLoading(btn, loading) {
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Loading...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._originalText || btn.innerHTML;
  }
}

// ── Format helpers ────────────────────────────────────────────
function formatCurrency(amount, symbol = '৳') {
  const n = parseFloat(amount) || 0;
  return `${symbol} ${n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusBadge(status) {
  const map = {
    lead:      'badge-yellow', prospect: 'badge-blue',
    customer:  'badge-green',  inactive: 'badge-gray',
    draft:     'badge-gray',   confirmed:'badge-blue',
    delivered: 'badge-green',  cancelled:'badge-red',
    unpaid:    'badge-yellow', partial:  'badge-blue',
    paid:      'badge-green',  overdue:  'badge-red',
    in:        'badge-green',  out:      'badge-red',
    adjustment:'badge-purple',
    admin:     'badge-purple', manager:  'badge-blue',
    staff:     'badge-gray',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}

// ── Debounce ──────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ── Build query string from object ───────────────────────────
function buildQuery(params) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
}

// ── Pagination renderer ───────────────────────────────────────
function renderPagination(container, total, page, limit, onPage) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = `<div class="pagination">`;
  html += `<button ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - page) > 2 && i !== 1 && i !== pages) {
      if (i === 2 || i === pages - 1) html += `<button disabled>…</button>`;
      continue;
    }
    html += `<button class="${i === page ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }
  html += `<button ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">›</button>`;
  html += `</div>`;
  container.innerHTML = html;
  container.querySelectorAll('button[data-p]').forEach(btn => {
    btn.addEventListener('click', () => onPage(Number(btn.dataset.p)));
  });
}

// ── Role-access banner ────────────────────────────────────────
// Shows a subtle read-only banner at the top of main-content for staff on partially-restricted pages
function showStaffReadOnlyBanner(message = "You have read-only access. Some actions require manager or admin permissions.") {
  const main = document.querySelector('.main-content');
  if (!main || document.getElementById('role-access-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'role-access-banner';
  banner.style.cssText = 'display:flex;align-items:center;gap:.65rem;background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--yellow);border-radius:var(--radius);padding:.7rem 1rem;margin-bottom:1.25rem;font-size:.82rem;color:var(--text-2)';
  banner.innerHTML = `<svg width="15" height="15" fill="none" stroke="var(--yellow)" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>${message}`;
  main.prepend(banner);
}


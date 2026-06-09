/* ============================================================
   HISHAB ERP — auth.js
   Session management, role guards, DOM visibility control
   ============================================================ */

function getUser()  {
  try { return JSON.parse(localStorage.getItem('hishab_user')); }
  catch { return null; }
}
function getToken() { return localStorage.getItem('hishab_token'); }

function setSession(token, user) {
  localStorage.setItem('hishab_token', token);
  localStorage.setItem('hishab_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('hishab_token');
  localStorage.removeItem('hishab_user');
}

// ── Page guards ───────────────────────────────────────────────

// Require login. Call on every protected page.
function requireAuth() {
  if (!getToken()) { window.location.href = '/pages/login.html'; return null; }
  return getUser();
}

// Require a specific role. Redirect to dashboard with an error toast if denied.
// Usage: requireRole('admin') or requireRole('admin', 'manager')
function requireRole(...roles) {
  const user = requireAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    // Store a flash message and redirect
    sessionStorage.setItem('hishab_flash', JSON.stringify({
      msg: `Access denied. This page requires ${roles.join(' or ')} access.`,
      type: 'error'
    }));
    window.location.href = '/pages/dashboard.html';
    return null;
  }
  return user;
}

// Redirect to dashboard if already logged in (use on login page)
function redirectIfLoggedIn() {
  if (getToken()) window.location.href = '/pages/dashboard.html';
}

function logout() {
  clearSession();
  window.location.href = '/pages/login.html';
}

// ── Role helpers ──────────────────────────────────────────────
function userRole()         { const u = getUser(); return u ? u.role : null; }
function isAdmin()          { return userRole() === 'admin'; }
function isManager()        { return userRole() === 'manager'; }
function isStaff()          { return userRole() === 'staff'; }
function isAdminOrManager() { return isAdmin() || isManager(); }

// ── Role-based DOM visibility ─────────────────────────────────
//
//   data-role="admin"           → admin only
//   data-role="admin,manager"   → admin or manager
//   data-role="!staff"          → everyone except staff
//
function applyRoleVisibility() {
  const role = userRole();
  document.querySelectorAll('[data-role]').forEach(el => {
    const rule = el.getAttribute('data-role').trim();
    let visible = false;
    if (rule.startsWith('!')) {
      const excluded = rule.slice(1).split(',').map(r => r.trim());
      visible = !excluded.includes(role);
    } else {
      const allowed = rule.split(',').map(r => r.trim());
      visible = allowed.includes(role);
    }
    if (!visible) { el.style.display = 'none'; el.setAttribute('aria-hidden', 'true'); }
  });
}

// Disable buttons/inputs that staff should not interact with.
// Add data-role-disable="admin,manager" to any control.
function applyRoleDisable() {
  const role = userRole();
  document.querySelectorAll('[data-role-disable]').forEach(el => {
    const allowed = el.getAttribute('data-role-disable').split(',').map(r => r.trim());
    if (!allowed.includes(role)) {
      el.disabled = true;
      el.title = 'Your role does not have permission for this action';
      el.style.cursor = 'not-allowed';
      el.style.opacity = '0.45';
    }
  });
}

// ── Sidebar user info ─────────────────────────────────────────
function populateSidebarUser() {
  const user = getUser();
  if (!user) return;

  const nameEl   = document.getElementById('sidebar-user-name');
  const roleEl   = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-avatar');
  if (nameEl)   nameEl.textContent = user.name;
  if (roleEl)   roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  if (avatarEl) avatarEl.textContent = user.name?.[0]?.toUpperCase() || 'U';

  const roleColors = { admin: '#A78BFA', manager: '#60A5FA', staff: 'rgba(255,255,255,.4)' };
  if (roleEl) roleEl.style.color = roleColors[user.role] || 'rgba(255,255,255,.4)';

  applyRoleVisibility();
  applyRoleDisable();

  // Show flash message from requireRole redirect
  const flash = sessionStorage.getItem('hishab_flash');
  if (flash) {
    sessionStorage.removeItem('hishab_flash');
    try {
      const { msg, type } = JSON.parse(flash);
      setTimeout(() => toast(msg, type), 300);
    } catch {}
  }
}

// ── Login page handler ────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errEl.classList.remove('show');
  btnLoading(btn, true);

  try {
    const data = await api.login(email, password);
    setSession(data.token, data.user);
    window.location.href = '/pages/dashboard.html';
  } catch (err) {
    errEl.textContent = err.message || 'Invalid email or password';
    errEl.classList.add('show');
    btnLoading(btn, false);
  }
}

/* ============================================================
   HISHAB ERP — auth.js
   Session management: login, logout, guard pages
   ============================================================ */

function getUser() {
  try { return JSON.parse(localStorage.getItem('hishab_user')); }
  catch { return null; }
}

function getToken() {
  return localStorage.getItem('hishab_token');
}

function setSession(token, user) {
  localStorage.setItem('hishab_token', token);
  localStorage.setItem('hishab_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('hishab_token');
  localStorage.removeItem('hishab_user');
}

// Call on protected pages — redirects to login if not authenticated
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/pages/login.html';
    return null;
  }
  return getUser();
}

// Call on login page — redirects to dashboard if already logged in
function redirectIfLoggedIn() {
  if (getToken()) {
    window.location.href = '/pages/dashboard.html';
  }
}

function logout() {
  clearSession();
  window.location.href = '/pages/login.html';
}

// Populate user info in sidebar
function populateSidebarUser() {
  const user = getUser();
  if (!user) return;
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = user.name?.[0]?.toUpperCase() || 'U';
}

// Login page handler
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
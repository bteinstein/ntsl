// auth.js — client-side credential check (POC)
const _NTSL_KEY = 'ntsl_auth';

function isAuthenticated() {
  return !!(sessionStorage.getItem(_NTSL_KEY) || localStorage.getItem(_NTSL_KEY));
}

function requireAuth() {
  if (!isAuthenticated()) window.location.replace('index.html');
}

function redirectIfAuthenticated() {
  if (isAuthenticated()) window.location.replace('dashboard.html');
}

function logout() {
  sessionStorage.removeItem(_NTSL_KEY);
  localStorage.removeItem(_NTSL_KEY);
  window.location.href = 'index.html';
}

async function _sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleLogin(e) {
  e.preventDefault();
  const username  = document.getElementById('username').value.trim().toLowerCase();
  const password  = document.getElementById('password').value;
  const remember  = document.getElementById('remember').checked;
  const errorEl   = document.getElementById('loginError');
  const btn       = document.getElementById('loginBtn');

  errorEl.hidden = true;
  btn.disabled   = true;
  btn.textContent = 'Signing in…';

  if (!window.PORTAL_DATA || !window.PORTAL_DATA.auth) {
    errorEl.textContent = 'Portal data not found. Contact administrator.';
    errorEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Sign in';
    return;
  }

  const auth = window.PORTAL_DATA.auth;
  const usernameHash = await _sha256(username);
  const passwordHash = await _sha256(password);

  if (usernameHash === auth.client_id && passwordHash === auth.password_hash) {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(_NTSL_KEY, '1');
    window.location.href = 'dashboard.html';
  } else {
    errorEl.textContent = 'Incorrect username or password.';
    errorEl.hidden = false;
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
    btn.disabled    = false;
    btn.textContent = 'Sign in';
  }
}

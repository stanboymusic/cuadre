

/* Autenticación con la colección "users" de PocketBase.
   No hay registro público: los usuarios se crean a mano desde el
   panel admin de PocketBase (Collections > users > + New record).

   Capas de protección de esta pantalla:
   1. Sesión respaldada en sessionStorage (ver store.js) — se pierde al
      cerrar la pestaña/navegador, no vive para siempre.
   2. Bloqueo temporal tras varios intentos fallidos seguidos (freno
      básico anti fuerza bruta desde el navegador).
   3. Cierre de sesión automático por inactividad. */

const IDLE_LIMIT_MS = 20 * 60 * 1000; // 20 minutos sin actividad
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minuto
const LOGIN_GUARD_KEY = 'mantente_login_guard';

/* failedAttempts/lockedUntil viven en sessionStorage (no solo en memoria):
   antes, un simple refresh (F5) reiniciaba estas variables a 0 y anulaba
   por completo el bloqueo anti fuerza-bruta. Ahora sobrevive mientras la
   pestaña siga abierta, igual que la sesión. */
function readLoginGuard() {
  try {
    const raw = sessionStorage.getItem(LOGIN_GUARD_KEY);
    if (!raw) return { failedAttempts: 0, lockedUntil: 0 };
    const d = JSON.parse(raw);
    return { failedAttempts: d.failedAttempts || 0, lockedUntil: d.lockedUntil || 0 };
  } catch (e) { return { failedAttempts: 0, lockedUntil: 0 }; }
}
function writeLoginGuard(state) {
  try { sessionStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(state)); } catch (e) { }
}

let { failedAttempts, lockedUntil } = readLoginGuard();
let idleTimer = null;

function isLoggedIn() {
  return pb.authStore.isValid;
}

function renderLogin() {
  stopIdleWatch();
  const app = document.getElementById('app');
  const locked = Date.now() < lockedUntil;
  app.innerHTML = `
<div class="login-wrap">
  <form class="card card-pad login-card" onsubmit="return handleLogin(event)">
    <img src="${LOGO_ICON}" alt="Mantente" class="login-logo">
    <div class="login-title">MANTENTE</div>
    <div class="login-sub">Decisiones claras, negocios rentables</div>
    <div class="field">
      <label>Usuario o correo</label>
      <input id="loginUser" type="text" autocomplete="username" required ${locked ? 'disabled' : ''}>
    </div>
    <div class="field">
      <label>Contraseña</label>
      <input id="loginPass" type="password" autocomplete="current-password" required ${locked ? 'disabled' : ''}>
    </div>
    <div id="loginError" class="login-error" style="display:none;"></div>
    <button class="btn btn-primary" id="loginBtn" style="width:100%;justify-content:center;padding:11px;" type="submit" ${locked ? 'disabled' : ''}>Entrar</button>
  </form>
</div>`;
  if (locked) {
    showLockoutMessage();
  } else {
    document.getElementById('loginUser').focus();
  }
}

function showLockoutMessage() {
  const errEl = document.getElementById('loginError');
  if (!errEl) return;
  const tick = () => {
    const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (remaining <= 0) { renderLogin(); return; }
    errEl.style.display = 'block';
    errEl.textContent = `Demasiados intentos fallidos. Intenta de nuevo en ${remaining}s.`;
    setTimeout(tick, 1000);
  };
  tick();
}

async function handleLogin(e) {
  e.preventDefault();
  if (Date.now() < lockedUntil) return false;
  const identity = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  btn.disabled = true;
  try {
    await pb.collection('users').authWithPassword(identity, password);
    failedAttempts = 0;
    writeLoginGuard({ failedAttempts, lockedUntil: 0 });
    await loadDB();
    render();
    startIdleWatch();
  } catch (err) {
    failedAttempts++;
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_MS;
      writeLoginGuard({ failedAttempts, lockedUntil });
      renderLogin();
      return false;
    }
    writeLoginGuard({ failedAttempts, lockedUntil: 0 });
    errEl.textContent = 'Usuario o contraseña incorrectos.';
    errEl.style.display = 'block';
    btn.disabled = false;
  }
  return false;
}

function logout() {
  pb.authStore.clear();
  // Redundancia a propósito: por si algún día vuelve a colarse algo en
  // localStorage (versiones viejas cacheadas, extensiones, etc.), lo
  // barremos también al cerrar sesión.
  try { localStorage.removeItem('pocketbase_auth'); localStorage.removeItem('pb_auth'); } catch (e) { }
  try { sessionStorage.clear(); } catch (e) { }
  renderLogin();
}

function startIdleWatch() {
  stopIdleWatch();
  const reset = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (isLoggedIn()) logout();
    }, IDLE_LIMIT_MS);
  };
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(ev =>
    window.addEventListener(ev, reset, { passive: true })
  );
  window._idleReset = reset;
  reset();
}

function stopIdleWatch() {
  clearTimeout(idleTimer);
  if (window._idleReset) {
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(ev =>
      window.removeEventListener(ev, window._idleReset)
    );
    window._idleReset = null;
  }
}

// Si el token expira o se invalida en cualquier momento, vuelve al login
pb.authStore.onChange(() => {
  if (!pb.authStore.isValid && document.getElementById('app')) renderLogin();
});

// Expose to global scope for inline HTML handlers
window.isLoggedIn = isLoggedIn;
window.renderLogin = renderLogin;
window.handleLogin = handleLogin;
window.logout = logout;
window.startIdleWatch = startIdleWatch;

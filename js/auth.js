

/* Autenticación simple con la colección "users" de PocketBase.
   No hay registro público: los usuarios se crean a mano desde el
   panel admin de PocketBase (Collections > users > + New record). */

function isLoggedIn() {
  return pb.authStore.isValid;
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
<div class="login-wrap">
  <form class="card card-pad login-card" onsubmit="return handleLogin(event)">
    <img src="${LOGO_ICON}" alt="Mantente" class="login-logo">
    <div class="login-title">MANTENTE</div>
    <div class="login-sub">Decisiones claras, negocios rentables</div>
    <div class="field">
      <label>Usuario o correo</label>
      <input id="loginUser" type="text" autocomplete="username" required>
    </div>
    <div class="field">
      <label>Contraseña</label>
      <input id="loginPass" type="password" autocomplete="current-password" required>
    </div>
    <div id="loginError" class="login-error" style="display:none;"></div>
    <button class="btn btn-primary" id="loginBtn" style="width:100%;justify-content:center;padding:11px;" type="submit">Entrar</button>
  </form>
</div>`;
  document.getElementById('loginUser').focus();
}

async function handleLogin(e) {
  e.preventDefault();
  const identity = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  btn.disabled = true;
  try {
    await pb.collection('users').authWithPassword(identity, password);
    await loadDB();
    render();
  } catch (err) {
    errEl.textContent = 'Usuario o contraseña incorrectos.';
    errEl.style.display = 'block';
    btn.disabled = false;
  }
  return false;
}

function logout() {
  pb.authStore.clear();
  renderLogin();
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

const TOKEN_KEY = 'kh_token';
const USER_KEY = 'kh_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

async function login(account, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  });
  saveSession(data.token, data.user);
  return data.user;
}

async function register({ account, password, displayName, avatar }) {
  const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ account, password, displayName, avatar }),
  });
  saveSession(data.token, data.user);
  return data.user;
}

async function fetchMe() {
  const data = await api('/auth/me');
  saveSession(getToken(), data.user);
  return data.user;
}

async function updateProfile(patch) {
  const data = await api('/profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  saveSession(getToken(), data.user);
  return data.user;
}

async function fetchPublicProfile(account) {
  const data = await api(`/profile/${encodeURIComponent(account)}`);
  return data.user;
}

function initAuthUI({ onSuccess }) {
  const authScreen = document.getElementById('auth-screen');
  const loginTab = document.getElementById('auth-tab-login');
  const registerTab = document.getElementById('auth-tab-register');
  const loginPanel = document.getElementById('auth-login-panel');
  const registerPanel = document.getElementById('auth-register-panel');
  const loginForm = document.getElementById('auth-login-form');
  const registerForm = document.getElementById('auth-register-form');
  const loginError = document.getElementById('auth-login-error');
  const registerError = document.getElementById('auth-register-error');

  let regSelectedAvatar = AVATAR_OPTIONS[0];

  function showAuthError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideAuthError(el) {
    el.classList.add('hidden');
  }

  function switchTab(tab) {
    const isLogin = tab === 'login';
    loginTab.classList.toggle('is-active', isLogin);
    registerTab.classList.toggle('is-active', !isLogin);
    loginPanel.classList.toggle('hidden', !isLogin);
    registerPanel.classList.toggle('hidden', isLogin);
    hideAuthError(loginError);
    hideAuthError(registerError);
  }

  loginTab.addEventListener('click', () => switchTab('login'));
  registerTab.addEventListener('click', () => switchTab('register'));

  const regAvatarPreview = document.getElementById('reg-avatar-preview');
  const regAvatarOptions = document.getElementById('reg-avatar-options');
  const regAvatarUpload = document.getElementById('reg-avatar-upload');

  buildAvatarPicker(regAvatarOptions, (emoji) => {
    regSelectedAvatar = emoji;
    setAvatarPreview(regAvatarPreview, emoji);
    regAvatarUpload.value = '';
  }, regSelectedAvatar);
  setAvatarPreview(regAvatarPreview, regSelectedAvatar);

  regAvatarUpload.addEventListener('change', () => {
    const file = regAvatarUpload.files[0];
    readAvatarFile(
      file,
      (dataUrl) => {
        regSelectedAvatar = dataUrl;
        setAvatarPreview(regAvatarPreview, dataUrl);
        regAvatarOptions.querySelectorAll('.avatar-option').forEach((b) => {
          b.classList.remove('is-selected');
        });
      },
      (msg) => showAuthError(registerError, msg)
    );
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError(loginError);
    const account = document.getElementById('login-account').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      const user = await login(account, password);
      authScreen.classList.add('hidden');
      onSuccess(user);
    } catch (err) {
      showAuthError(loginError, err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError(registerError);
    const account = document.getElementById('reg-account').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;
    const displayName = document.getElementById('reg-display-name').value.trim();

    if (password !== confirm) {
      showAuthError(registerError, '两次输入的密码不一致');
      return;
    }

    try {
      const user = await register({
        account,
        password,
        displayName,
        avatar: regSelectedAvatar,
      });
      authScreen.classList.add('hidden');
      onSuccess(user);
    } catch (err) {
      showAuthError(registerError, err.message);
    }
  });

  return {
    show() {
      authScreen.classList.remove('hidden');
      switchTab('login');
    },
    hide() {
      authScreen.classList.add('hidden');
    },
  };
}

async function tryAutoLogin(onSuccess, onFail) {
  const token = getToken();
  if (!token) {
    onFail();
    return;
  }
  try {
    const user = await fetchMe();
    onSuccess(user);
  } catch {
    clearSession();
    onFail();
  }
}

function logout() {
  clearSession();
}

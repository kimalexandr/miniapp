const ADMIN_TOKEN_KEY = 'admin_token';
const API_BASE = typeof window !== 'undefined' && window.APP_API_BASE ? window.APP_API_BASE : '';

function getToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

async function api(path, options = {}) {
  const url = (API_BASE || '') + '/api/' + path;
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.json) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body,
  });
  if (res.status === 401 && path !== 'admin/login') {
    setToken(null);
    showLogin();
    throw new Error('Сессия истекла');
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = j.message || j.error || text;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

function showLogin() {
  document.getElementById('login-block').style.display = 'block';
  document.getElementById('users-block').style.display = 'none';
  document.getElementById('login-error').textContent = '';
}

function showUsers() {
  document.getElementById('login-block').style.display = 'none';
  document.getElementById('users-block').style.display = 'block';
  document.getElementById('users-error').textContent = '';
  loadUsers();
}

function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  const errEl = document.getElementById('users-error');
  tbody.innerHTML = '<tr><td colspan="8">Загрузка…</td></tr>';
  api('admin/users')
    .then((users) => {
      if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="8">Нет пользователей</td></tr>';
        return;
      }
      tbody.innerHTML = users
        .map(
          (u) => `
        <tr data-id="${u.id}">
          <td>${new Date(u.createdAt).toLocaleString('ru')}</td>
          <td>${u.telegramId}</td>
          <td>${u.username ? '@' + u.username : '—'}</td>
          <td>${[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
          <td>${u.role || '—'}</td>
          <td>${u.status}</td>
          <td>${u.phone ? (u.phone.length > 4 ? '***' + u.phone.slice(-4) : u.phone) : '—'}</td>
          <td><button type="button" class="btn-danger btn-delete" data-id="${u.id}">Удалить</button></td>
        </tr>
      `
        )
        .join('');
      tbody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', () => deleteUser(btn.dataset.id));
      });
    })
    .catch((e) => {
      errEl.textContent = e?.message || 'Ошибка загрузки';
      tbody.innerHTML = '';
    });
}

function deleteUser(id) {
  if (!confirm('Удалить пользователя? Это действие нельзя отменить.')) return;
  api('admin/users/' + id, { method: 'DELETE' })
    .then(() => loadUsers())
    .catch((e) => {
      document.getElementById('users-error').textContent = e?.message || 'Ошибка удаления';
    });
}

document.getElementById('login-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  api('admin/login', { method: 'POST', json: { email, password } })
    .then((res) => {
      setToken(res.accessToken);
      showUsers();
    })
    .catch((e) => {
      errEl.textContent = e?.message || 'Ошибка входа';
    });
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
  setToken(null);
  showLogin();
});

if (getToken()) {
  showUsers();
} else {
  showLogin();
}

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
  document.getElementById('orders-error').textContent = '';
  loadUsers();
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const usersPanel = document.getElementById('admin-users-panel');
  const ordersPanel = document.getElementById('admin-orders-panel');
  if (tab === 'users') {
    if (usersPanel) usersPanel.style.display = 'block';
    if (ordersPanel) ordersPanel.style.display = 'none';
  } else {
    if (usersPanel) usersPanel.style.display = 'none';
    if (ordersPanel) ordersPanel.style.display = 'block';
    loadOrders();
  }
}

const STATUS_LABELS = {
  NEW: 'Новая',
  DRAFT: 'Черновик',
  PUBLISHED: 'Ожидает откликов',
  TAKEN: 'Взята',
  AT_WAREHOUSE: 'На складе',
  LOADING_DONE: 'Загрузка',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлено',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

function loadOrders() {
  const container = document.getElementById('orders-list');
  const errEl = document.getElementById('orders-error');
  if (!container) return;
  container.innerHTML = '<p>Загрузка…</p>';
  errEl.textContent = '';
  api('admin/orders')
    .then((orders) => {
      if (!orders.length) {
        container.innerHTML = '<p>Нет заявок</p>';
        return;
      }
      let html = '<table><thead><tr>';
      html += '<th>№</th><th>Дата</th><th>Статус</th><th>Клиент</th><th>Откуда</th><th>Куда</th>';
      html += '<th>Груз</th><th>Подача</th><th>Контакт</th><th>Цена</th><th>Оплата</th><th>Водитель</th><th></th>';
      html += '</tr></thead><tbody>';
      orders.forEach((o) => {
        const clientName = o.client?.companyName || [o.client?.user?.firstName, o.client?.user?.lastName].filter(Boolean).join(' ') || '—';
        const fromAddr = o.fromWarehouse ? (o.fromWarehouse.name || o.fromWarehouse.address || '—') : '—';
        const cargo = [o.cargoPlaces && o.cargoPlaces + ' мест', o.cargoType, o.cargoWeight && o.cargoWeight + ' кг'].filter(Boolean).join(', ') || '—';
        const preferred = o.preferredDate ? new Date(o.preferredDate).toLocaleDateString('ru') + (o.preferredTimeFrom || o.preferredTimeTo ? ' ' + [o.preferredTimeFrom, o.preferredTimeTo].filter(Boolean).join('–') : '') : '—';
        const contact = [o.contactName, o.contactPhone].filter(Boolean).join(', ') || '—';
        const driverName = o.driver?.user ? [o.driver.user.firstName, o.driver.user.lastName].filter(Boolean).join(' ') || o.driver.user.username : '—';
        const detailId = 'order-detail-' + o.id;
        html += '<tr>';
        html += `<td>${o.orderNumber || o.id}</td>`;
        html += `<td>${new Date(o.createdAt).toLocaleString('ru')}</td>`;
        html += `<td>${STATUS_LABELS[o.status] || o.status}</td>`;
        html += `<td>${escapeHtml(clientName)}</td>`;
        html += `<td>${escapeHtml(fromAddr)}</td>`;
        html += `<td>${escapeHtml(o.toAddress || '—')}</td>`;
        html += `<td>${escapeHtml(cargo)}</td>`;
        html += `<td>${escapeHtml(preferred)}</td>`;
        html += `<td>${escapeHtml(contact)}</td>`;
        html += `<td>${o.price != null ? o.price + ' ₽' : '—'}</td>`;
        html += `<td>${escapeHtml(o.paymentType || '—')}</td>`;
        html += `<td>${escapeHtml(driverName)}</td>`;
        html += `<td><button type="button" class="btn-ghost order-toggle-detail" data-id="${o.id}">▼</button></td>`;
        html += '</tr>';
        html += `<tr class="order-detail-row" id="${detailId}" data-order-id="${o.id}"><td colspan="13" class="order-detail-cell">`;
        html += '<div class="grid">';
        html += `<span>Особые условия:</span> ${escapeHtml(o.specialConditions || '—')}`;
        html += `<span>Забор со склада:</span> ${o.pickupRequired ? 'Да' : 'Нет'}`;
        html += `<span>Дедлайн откликов:</span> ${o.responseDeadline ? new Date(o.responseDeadline).toLocaleString('ru') : '—'}`;
        if (o.client?.user?.phone) html += `<span>Телефон клиента:</span> ${escapeHtml(o.client.user.phone)}`;
        if (o.driver?.user?.phone) html += `<span>Телефон водителя:</span> ${escapeHtml(o.driver.user.phone)}`;
        if (o.statusHistory?.length) {
          html += '<span>История статусов:</span>';
          html += o.statusHistory.map((h) => new Date(h.createdAt).toLocaleString('ru') + ' — ' + (STATUS_LABELS[h.status] || h.status) + (h.comment ? ': ' + h.comment : '')).join('; ');
        }
        html += '</div></td></tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
      container.querySelectorAll('.order-toggle-detail').forEach((btn) => {
        btn.addEventListener('click', () => {
          const row = document.getElementById('order-detail-' + btn.dataset.id);
          if (row) {
            row.classList.toggle('expanded');
            btn.textContent = row.classList.contains('expanded') ? '▲' : '▼';
          }
        });
      });
    })
    .catch((e) => {
      errEl.textContent = e?.message || 'Ошибка загрузки';
      container.innerHTML = '';
    });
}

function escapeHtml(s) {
  if (s == null) return '—';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
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

document.querySelectorAll('.admin-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
});

if (getToken()) {
  showUsers();
} else {
  showLogin();
}

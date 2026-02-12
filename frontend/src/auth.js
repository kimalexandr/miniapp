import { api, setToken, getToken, getInitData } from './api.js';

/** Полностью авторизован: есть токен и пользователь в статусе ACTIVE */
export function isFullyLoggedIn() {
  return !!(getToken() && window.AppUser && window.AppUser.status === 'ACTIVE');
}

export function startAuth() {
  const msgEl = document.getElementById('auth-loading-message');
  if (msgEl) msgEl.textContent = 'Проверка авторизации…';
  const initData = getInitData();
  if (!initData) {
    const token = getToken();
    if (token) {
      api('users/me')
        .then((user) => {
          window.AppUser = user;
          if (user.status === 'PENDING_PHONE') window.showScreen('auth-phone');
          else if (user.status === 'PENDING_ROLE') window.showScreen('auth-choose-role');
          else window.goHome();
        })
        .catch(() => {
          setToken(null);
          window.AppUser = null;
          showAuthOnlyMessage('Сессия истекла. Откройте приложение в Telegram снова.');
        });
      return;
    }
    showAuthOnlyMessage('Для входа откройте мини-приложение в Telegram.');
    return;
  }
  api('auth/telegram', { method: 'POST', json: { initData } })
    .then((res) => {
      setToken(res.accessToken);
      window.AppUser = res.user;
      if (res.user.status === 'PENDING_PHONE') window.showScreen('auth-phone');
      else if (res.user.status === 'PENDING_ROLE' || res.isNew) window.showScreen('auth-choose-role');
      else window.goHome();
    })
    .catch((err) => {
      const msg = err?.message || 'Ошибка входа';
      const el = document.getElementById('auth-phone-error');
      if (el) {
        el.textContent = msg;
        el.style.display = 'block';
      }
      window.showScreen('auth-phone');
    });
}

function showAuthOnlyMessage(text) {
  const el = document.getElementById('auth-loading-message');
  if (el) el.textContent = text;
  window.showScreen('auth-loading');
}

export function goHome() {
  const u = window.AppUser;
  const isDriver = u?.role === 'DRIVER';
  const hint = document.getElementById('driver-bids-hint');
  const clientBlock = document.getElementById('home-links-client');
  const driverBlock = document.getElementById('home-links-driver');
  if (hint) hint.style.display = isDriver ? 'block' : 'none';
  if (clientBlock) clientBlock.style.display = isDriver ? 'none' : 'block';
  if (driverBlock) driverBlock.style.display = isDriver ? 'block' : 'none';
  document.querySelectorAll('[data-role]').forEach((b) => {
    b.classList.toggle('active', b.dataset.role === (isDriver ? 'driver' : 'client'));
  });
  window.showScreen('home');
}

export function bindAuthUI() {
  document.getElementById('auth-phone-request')?.addEventListener('click', () => {
    let phone = (document.getElementById('auth-phone-input')?.value || '').replace(/\D/g, '');
    if (phone.length < 10) phone = '7' + phone;
    if (phone.length < 11) phone = '7' + phone;
    phone = '+' + phone;
    document.getElementById('auth-phone-error').style.display = 'none';
    api('auth/phone/request-code', { method: 'POST', json: { phone } })
      .then(() => {
        document.getElementById('auth-phone-confirm-block').style.display = 'block';
        document.getElementById('auth-phone-code').value = '';
      })
      .catch((e) => {
        document.getElementById('auth-phone-error').textContent = e?.message || 'Ошибка';
        document.getElementById('auth-phone-error').style.display = 'block';
      });
  });

  document.getElementById('auth-phone-confirm')?.addEventListener('click', () => {
    let phone = (document.getElementById('auth-phone-input')?.value || '').replace(/\D/g, '');
    if (phone.length < 10) phone = '7' + phone;
    phone = '+' + phone;
    const code = document.getElementById('auth-phone-code')?.value?.trim() || '';
    document.getElementById('auth-phone-error').style.display = 'none';
    api('auth/phone/confirm', { method: 'POST', json: { phone, code } })
      .then((res) => {
        if (res.accessToken) setToken(res.accessToken);
        api('users/me').then((user) => {
          window.AppUser = user;
          if (user.status === 'PENDING_ROLE') window.showScreen('auth-choose-role');
          else window.goHome();
        });
      })
      .catch((e) => {
        document.getElementById('auth-phone-error').textContent = e?.message || 'Неверный код';
        document.getElementById('auth-phone-error').style.display = 'block';
      });
  });

  let chosenRole = 'CLIENT';
  document.querySelectorAll('[data-choose-role]').forEach((btn) => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-choose-role]').forEach((b) => b.classList.remove('active'));
      this.classList.add('active');
      chosenRole = this.dataset.chooseRole;
    });
  });

  document.getElementById('auth-role-submit')?.addEventListener('click', () => {
    api('auth/choose-role', { method: 'POST', json: { role: chosenRole } })
      .then((res) => {
        if (res.accessToken) setToken(res.accessToken);
        window.AppUser = window.AppUser || {};
        window.AppUser.role = chosenRole;
        window.AppUser.status = 'ACTIVE';
        goHome();
      })
      .catch((e) => alert(e?.message || 'Ошибка'));
  });
}

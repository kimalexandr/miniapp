const STORAGE_TOKEN = 'courier_miniapp_token';
let onUnauthorized = () => {};

export function getApiBase() {
  const b = window.APP_API_BASE;
  if (b && b.startsWith('http')) return b.replace(/\/$/, '');
  return (window.location.origin || '').replace(/\/$/, '') + (b || '/api');
}

export function getToken() {
  return localStorage.getItem(STORAGE_TOKEN);
}

export function setToken(t) {
  if (t) localStorage.setItem(STORAGE_TOKEN, t);
  else localStorage.removeItem(STORAGE_TOKEN);
}

export function getInitData() {
  try {
    return typeof Telegram !== 'undefined' && Telegram?.WebApp?.initData
      ? Telegram.WebApp.initData
      : '';
  } catch {
    return '';
  }
}

export function setApiUnauthorized(fn) {
  onUnauthorized = fn;
}

export function api(path, opts = {}) {
  const url = getApiBase() + (path.startsWith('/') ? path : '/' + path);
  const headers = { ...(opts.headers || {}) };
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.json);
  }
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  return fetch(url, { ...opts, method: opts.method || 'GET', headers })
    .then((r) => {
      if (r.status === 401) {
        setToken(null);
        window.AppUser = null;
        onUnauthorized();
        return Promise.reject(new Error('Unauthorized'));
      }
      if (!r.ok) {
        return r.json().then((j) => Promise.reject(j)).catch(() => Promise.reject(new Error(r.statusText)));
      }
      return r.headers.get('content-type')?.includes('json') ? r.json() : r.text();
    });
}

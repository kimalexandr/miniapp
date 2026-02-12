import { api, setApiUnauthorized } from './api.js';
import { startAuth, goHome, bindAuthUI } from './auth.js';
import { showScreen, bindAppUI } from './app.js';

window.APP_API_BASE =
  window.APP_API_BASE ||
  (typeof Telegram !== 'undefined' && Telegram?.WebApp?.initDataUnsafe ? '' : 'http://localhost:3000/api');

window.AppUser = null;
window.showScreen = showScreen;
window.goHome = goHome;
window.startAuth = startAuth;
window.api = api;

setApiUnauthorized(() => {
  showScreen('auth-loading');
  startAuth();
});

bindAuthUI();
bindAppUI();

document.addEventListener('DOMContentLoaded', () => {
  showScreen('auth-loading');
  startAuth();
});

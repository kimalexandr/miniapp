import { api } from './api.js';
import { isFullyLoggedIn } from './auth.js';

const PROTECTED_SCREENS = [
  'home', 'order', 'orders', 'order-detail', 'map',
  'profile-client', 'profile-driver', 'profile-client-view',
  'order-status-driver', 'driver-status', 'driver-card', 'chat', 'dispute', 'rating',
];

export function getVal(id) {
  const e = document.getElementById(id);
  return e ? e.value.trim() : '';
}

export function showScreen(screenId) {
  const isAuthScreen = ['auth-loading', 'auth-phone', 'auth-choose-role'].includes(screenId);
  if (!isAuthScreen && PROTECTED_SCREENS.includes(screenId) && !isFullyLoggedIn()) {
    window.showScreen('auth-loading');
    if (typeof window.startAuth === 'function') window.startAuth();
    return;
  }
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById('screen-' + screenId);
  if (el) el.classList.add('active');
  const nav = document.querySelector('.nav-tabs');
  if (nav) nav.style.display = isFullyLoggedIn() ? 'flex' : 'none';
  document.querySelectorAll('.nav-tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === screenId);
  });
  if (screenId === 'orders') loadOrdersList();
  if (screenId === 'profile-client') loadClientProfile();
  if (screenId === 'profile-driver') loadDriverProfile();
  if (screenId === 'map') loadMapData();
  if (screenId === 'order') loadOrderWarehouses();
  if (screenId === 'driver-status') loadDriverStatus();
  if (screenId === 'driver-card' && window._currentDriverId) loadDriverCard(window._currentDriverId);
  if (screenId === 'order-detail' && window._currentOrderId) loadOrderDetail(window._currentOrderId);
  if (screenId === 'profile-client-view') loadProfileClientView();
}

export function loadOrderWarehouses() {
  api('warehouses')
    .then((list) => {
      const sel = document.getElementById('order-from-warehouse');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Выбрать склад —</option>';
      (list || []).forEach((w) => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name || w.address || w.id;
        sel.appendChild(opt);
      });
    })
    .catch(() => {});
}

export function loadOrdersList() {
  const u = window.AppUser;
  if (!u?.role) return;
  const listEl = document.getElementById('orders-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="card-title">Загрузка…</p>';
  api('orders?role=' + u.role)
    .then((orders) => {
      const statusLabels = { NEW: 'Новая', DRAFT: 'Черновик', PUBLISHED: 'Ожидает откликов', TAKEN: 'Взята', AT_WAREHOUSE: 'На складе', LOADING_DONE: 'Загрузка', IN_TRANSIT: 'В пути', DELIVERED: 'Доставлено', COMPLETED: 'Завершена', CANCELLED: 'Отменена' };
      const statusClass = { NEW: 'published', DRAFT: 'draft', PUBLISHED: 'published', TAKEN: 'taken', IN_TRANSIT: 'in_progress', LOADING_DONE: 'in_progress', AT_WAREHOUSE: 'in_progress', DELIVERED: 'in_progress', COMPLETED: 'completed', CANCELLED: 'cancelled' };
      let html = '';
      (orders || []).forEach((o) => {
        const fromAddr = o.fromWarehouse?.address || o.fromWarehouse?.name || '—';
        const toAddr = o.toAddress || '—';
        const dateStr = o.preferredDate ? new Date(o.preferredDate).toLocaleDateString('ru') : '—';
        const timeStr = [o.preferredTimeFrom, o.preferredTimeTo].filter(Boolean).join('–') || '';
        const dateTimeStr = timeStr ? dateStr + ', ' + timeStr : dateStr;
        const cargoStr = [o.cargoPlaces && o.cargoPlaces + ' мест', o.cargoType, o.cargoWeight && 'до ' + o.cargoWeight + ' кг'].filter(Boolean).join(', ') || '—';
        const priceStr = o.price != null ? (typeof o.price === 'object' ? o.price.toString() : o.price) + ' ₽' : '—';
        const driverName = o.driver?.user ? (o.driver.user.firstName || '') + ' ' + (o.driver.user.lastName || '') : '';
        html += `<div class="order-item" data-status="${statusClass[o.status] || ''}" data-order-id="${o.id}">`;
        html += `<div class="head"><span class="route">${o.orderNumber || o.id}</span><span class="status-badge ${statusClass[o.status] || ''}">${statusLabels[o.status] || o.status}</span></div>`;
        html += `<div class="meta"><span class="text-muted">Откуда:</span> ${fromAddr}</div>`;
        html += `<div class="meta"><span class="text-muted">Куда:</span> ${toAddr}</div>`;
        html += `<div class="meta"><span class="text-muted">Дата и время:</span> ${dateTimeStr}</div>`;
        html += `<div class="meta"><span class="text-muted">Груз:</span> ${cargoStr}</div>`;
        html += `<div class="meta"><span class="text-muted">Стоимость:</span> ${priceStr}</div>`;
        if (driverName) html += `<div class="meta">Водитель: ${driverName}</div>`;
        html += '<div class="order-actions">';
        if (u.role === 'DRIVER' && !o.driverId && (o.status === 'NEW' || o.status === 'PUBLISHED')) {
          html += '<button type="button" class="btn btn-primary btn-small order-btn-take">Взять в работу</button>';
        }
        if (u.role === 'DRIVER' && o.driverId && ['TAKEN', 'AT_WAREHOUSE', 'LOADING_DONE', 'IN_TRANSIT', 'DELIVERED'].includes(o.status)) {
          html += '<button type="button" class="btn btn-primary btn-small order-btn-status">Сменить статус</button>';
        }
        if (o.status === 'COMPLETED' && !o.ratings?.some(r => r.raterRole === u.role)) {
          html += '<button type="button" class="btn btn-primary btn-small order-btn-rate">Оценить</button>';
        }
        html += `<button type="button" class="btn btn-ghost btn-small" data-go="order-detail" data-order-id="${o.id}">Подробнее</button></div></div>`;
      });
      listEl.innerHTML = html || '<p class="card-title">Нет заявок</p>';
      listEl.querySelectorAll('.order-btn-take').forEach((btn) => {
        const item = btn.closest('.order-item');
        btn.addEventListener('click', () => {
          api('orders/' + item.dataset.orderId + '/take', { method: 'POST' })
            .then(() => { loadOrdersList(); showScreen('orders'); })
            .catch((e) => alert(e?.message || 'Ошибка'));
        });
      });
      listEl.querySelectorAll('.order-btn-status').forEach((btn) => {
        const item = btn.closest('.order-item');
        btn.addEventListener('click', () => {
          window._currentOrderId = item.dataset.orderId;
          showScreen('order-status-driver');
        });
      });
      listEl.querySelectorAll('.order-btn-rate').forEach((btn) => {
        const item = btn.closest('.order-item');
        btn.addEventListener('click', () => {
          window._currentOrderId = item.dataset.orderId;
          const order = orders.find(o => o.id === item.dataset.orderId);
          const titleEl = document.getElementById('rating-order-title');
          if (titleEl && order) {
            titleEl.textContent = `Заявка ${order.orderNumber || order.id}`;
          }
          showScreen('rating');
        });
      });
      listEl.querySelectorAll('[data-go="order-detail"][data-order-id]').forEach((link) => {
        link.addEventListener('click', function () {
          window._currentOrderId = this.dataset.orderId;
          loadOrderDetail(this.dataset.orderId);
          showScreen('order-detail');
        });
      });
    })
    .catch(() => {
      listEl.innerHTML = '<p class="card-title text-muted">Ошибка загрузки</p>';
    });
}

const ORDER_STATUS_LABELS = {
  NEW: 'Новая',
  DRAFT: 'Черновик',
  PUBLISHED: 'Ожидает откликов',
  TAKEN: 'Взята',
  AT_WAREHOUSE: 'На складе',
  LOADING_DONE: 'Загрузка завершена',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлено',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

export function loadOrderDetail(id) {
  api('orders/' + id).then((o) => {
    const fromAddr = o.fromWarehouse?.address || '—';
    const titleEl = document.getElementById('order-detail-title');
    const contentEl = document.getElementById('order-detail-content');
    const actionsEl = document.getElementById('order-detail-actions');
    if (titleEl) titleEl.textContent = (o.orderNumber || o.id) + ' · ' + (o.toAddress || '');

    const priceStr = o.price != null ? (typeof o.price === 'object' ? o.price.toString() : o.price) + ' ₽' : '—';
    const dateStr = o.preferredDate ? new Date(o.preferredDate).toLocaleString('ru') : '—';
    const timeRange = [o.preferredTimeFrom, o.preferredTimeTo].filter(Boolean).join(' – ') || '—';

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="section-title">Статус</div>
        <div class="mb-16">${ORDER_STATUS_LABELS[o.status] || o.status}</div>
        <div class="section-title">Откуда</div>
        <div class="mb-16">${fromAddr}</div>
        <div class="section-title">Адрес назначения</div>
        <div class="mb-16">${o.toAddress || '—'}</div>
        <div class="section-title">Груз</div>
        <div class="mb-16">${o.cargoPlaces ? o.cargoPlaces + ' мест' : '—'}, ${o.cargoType || '—'}${o.cargoWeight ? ', до ' + o.cargoWeight + ' кг' : ''}</div>
        <div class="section-title">Дата и время подачи</div>
        <div class="mb-16">${dateStr}${timeRange !== '—' ? ', ' + timeRange : ''}</div>
        <div class="section-title">Забор со склада</div>
        <div class="mb-16">${o.pickupRequired ? 'Да' : 'Нет'}</div>
        ${o.specialConditions ? `<div class="section-title">Особые условия</div><div class="mb-16">${o.specialConditions}</div>` : ''}
        <div class="section-title">Контакт</div>
        <div class="mb-16">${o.contactName || '—'}, ${o.contactPhone || '—'}</div>
        <div class="section-title">Цена</div>
        <div class="mb-16">${priceStr}</div>
        <div class="section-title">Оплата</div>
        <div>${o.paymentType || '—'}</div>
      `;
    }

    if (actionsEl) {
      actionsEl.innerHTML = '';
      const isClient = window.AppUser?.role === 'CLIENT';
      const canEditOrUnpublish = isClient && (o.status === 'NEW' || o.status === 'PUBLISHED') && !o.driverId;

      if (canEditOrUnpublish) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-primary btn-small mr-8';
        editBtn.textContent = 'Редактировать';
        editBtn.onclick = () => {
          window._currentOrderId = o.id;
          loadOrderForEdit(o);
          showScreen('order');
        };
        actionsEl.appendChild(editBtn);
        if (o.status === 'PUBLISHED') {
          const unpublishBtn = document.createElement('button');
          unpublishBtn.className = 'btn btn-ghost btn-small';
          unpublishBtn.textContent = 'Снять с публикации';
          unpublishBtn.onclick = () => {
            if (!confirm('Снять заявку с публикации? Водители больше не увидят её.')) return;
            api('orders/' + o.id + '/unpublish', { method: 'POST' })
              .then(() => {
                loadOrderDetail(o.id);
                showScreen('orders');
                loadOrdersList();
              })
              .catch((e) => alert(e?.message || 'Ошибка'));
          };
          actionsEl.appendChild(unpublishBtn);
        }
      }

      if (window.AppUser?.role === 'DRIVER' && o.driverId && ['TAKEN', 'AT_WAREHOUSE', 'LOADING_DONE', 'IN_TRANSIT'].includes(o.status)) {
        const statusBtn = document.createElement('button');
        statusBtn.className = 'btn btn-primary btn-small';
        statusBtn.textContent = 'Сменить статус';
        statusBtn.onclick = () => {
          window._currentOrderId = o.id;
          showScreen('order-status-driver');
        };
        actionsEl.appendChild(statusBtn);
      }
    }
  });
}

function loadOrderForEdit(o) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v != null ? v : '';
  };
  set('order-from-warehouse', o.fromWarehouseId);
  set('order-from-address', o.fromWarehouse?.address || '');
  set('order-to-address', o.toAddress);
  set('order-preferred-date', o.preferredDate ? new Date(o.preferredDate).toISOString().slice(0, 10) : '');
  set('order-time-from', o.preferredTimeFrom || '');
  set('order-time-to', o.preferredTimeTo || '');
  set('order-cargo-places', o.cargoPlaces);
  const cargoSelect = document.getElementById('cargo-type-select');
  if (cargoSelect) cargoSelect.value = o.cargoType || 'pallet';
  set('order-cargo-weight', o.cargoWeight);
  set('order-pickup', o.pickupRequired ? '1' : '0');
  set('order-special', o.specialConditions);
  set('order-contact-name', o.contactName);
  set('order-contact-phone', o.contactPhone);
  set('order-price', o.price != null ? (typeof o.price === 'object' ? o.price.toString() : o.price) : '');
  const paymentSelect = document.getElementById('order-payment');
  if (paymentSelect) paymentSelect.value = o.paymentType || 'Наличные';
}

export function loadProfileClientView() {
  function setViewVal(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '—';
  }
  function setViewRowVal(rowId, text) {
    const row = document.getElementById(rowId);
    const val = row?.querySelector('.val');
    if (val) val.textContent = text || '—';
  }

  Promise.all([api('clients/profile').catch(() => ({})), api('warehouses').catch(() => [])])
    .then(([profile, warehouses]) => {
      setViewRowVal('client-view-company', profile.companyName);
      setViewRowVal('client-view-inn', profile.inn);
      const firstWarehouse = Array.isArray(warehouses) && warehouses[0];
      setViewRowVal('client-view-address', firstWarehouse?.address);
      setViewVal('client-view-schedule', firstWarehouse?.workSchedule);
      setViewVal('client-view-parking', ''); // в API нет поля парковки
      setViewVal('client-view-phone', profile.contactPhone);
      const telegram = window.AppUser?.username;
      setViewVal('client-view-telegram', telegram ? '@' + telegram : '—');
      setViewVal('client-view-payment', ''); // в API нет поля форма оплаты в профиле
    })
    .catch(() => {});
}

export function loadClientProfile() {
  api('clients/profile')
    .then((p) => {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
      set('profile-client-company', p.companyName);
      set('profile-client-type', p.companyType);
      set('profile-client-inn', p.inn);
      set('profile-client-kpp', p.kpp);
      set('profile-client-legal', p.legalAddress);
      set('profile-client-email', p.email);
      set('profile-client-contact-name', p.contactName);
      set('profile-client-contact-phone', p.contactPhone);
      set('profile-client-contact-email', p.contactEmail);
    })
    .catch(() => {});
  
  // Загружаем статистику рейтингов
  loadMyRatings();
}

export function loadDriverProfile() {
  api('drivers/profile')
    .then((p) => {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
      set('profile-driver-fullname', p.fullName);
      set('profile-driver-email', p.email);
      set('profile-driver-vehicle', p.vehicleType);
      set('profile-driver-plate', p.vehiclePlate);
      set('profile-driver-capacity', p.loadCapacity);
      set('profile-driver-license', p.licenseNumber);
      set('profile-driver-status', p.driverStatus || '');
    })
    .catch(() => {});
  
  // Загружаем статистику рейтингов
  loadMyRatings();
}

export function loadDriverStatus() {
  api('drivers/profile')
    .then((p) => {
      // Обновляем данные о грузоподъемности
      const placesEl = document.getElementById('driver-capacity-places');
      const weightEl = document.getElementById('driver-capacity-weight');
      
      if (placesEl) {
        placesEl.textContent = p.dimensions || '—';
      }
      if (weightEl) {
        weightEl.textContent = p.loadCapacity ? `${p.loadCapacity}` : '—';
      }
      
      // Устанавливаем текущий статус
      const currentStatus = p.driverStatus || 'free';
      document.querySelectorAll('.status-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.status === currentStatus);
      });
      
      // Показываем/скрываем блок догруза
      const dogruzBlock = document.getElementById('dogruz-block');
      if (dogruzBlock) {
        dogruzBlock.style.display = currentStatus === 'dogruz' ? 'block' : 'none';
      }
    })
    .catch(() => {});
}

export function loadDriverCard(driverId) {
  api('drivers/' + driverId)
    .then((d) => {
      // ФИО и контакты
      const nameEl = document.getElementById('driver-card-name');
      const phoneEl = document.getElementById('driver-card-phone');
      const telegramEl = document.getElementById('driver-card-telegram');
      
      if (nameEl) {
        nameEl.textContent = d.fullName || [d.user?.firstName, d.user?.lastName].filter(Boolean).join(' ') || '—';
      }
      if (phoneEl) {
        phoneEl.textContent = d.user?.phone || '—';
      }
      if (telegramEl) {
        telegramEl.textContent = d.user?.username ? '@' + d.user.username : '—';
      }
      
      // Перевозок и рейтинг
      const completedEl = document.querySelector('#driver-card-contact .profile-row:nth-child(4) .val');
      const ratingEl = document.querySelector('#driver-card-contact .profile-row:nth-child(5) .val');
      const starsEl = document.querySelector('#driver-card-contact .rating-stars');
      
      if (completedEl) {
        completedEl.textContent = d.completedOrders || 0;
      }
      if (ratingEl && d.totalRatings > 0) {
        ratingEl.textContent = d.averageRating || '—';
        if (starsEl) {
          const fullStars = Math.round(d.averageRating);
          starsEl.textContent = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        }
      }
      
      // Техника
      const vehicleTypeEl = document.getElementById('driver-card-vehicle-type');
      const capacityEl = document.getElementById('driver-card-capacity');
      const plateEl = document.getElementById('driver-card-plate');
      
      if (vehicleTypeEl) {
        vehicleTypeEl.textContent = d.vehicleType || '—';
      }
      if (capacityEl) {
        capacityEl.textContent = d.loadCapacity || '—';
      }
      if (plateEl) {
        plateEl.textContent = d.vehiclePlate || '—';
      }
    })
    .catch(() => {
      alert('Ошибка загрузки профиля водителя');
    });
}

function loadMyRatings() {
  api('ratings/my-stats')
    .then((stats) => {
      // Обновляем блок рейтинга в профиле
      const ratingBlock = document.querySelector('#screen-profile-client .card:last-of-type, #screen-profile-driver .card:last-of-type');
      if (!ratingBlock) return;
      
      if (stats.totalCount === 0) {
        ratingBlock.querySelector('.block-title').nextElementSibling.textContent = 'Рейтинги появятся после выполненных заказов';
        return;
      }
      
      const stars = '★'.repeat(Math.round(stats.averageScore)) + '☆'.repeat(5 - Math.round(stats.averageScore));
      let html = `<div class="profile-row">
        <span class="key">Средний балл</span>
        <span class="val rating-big">${stats.averageScore}</span>
        <span class="rating-stars">${stars}</span>
      </div>`;
      html += `<div class="profile-row"><span class="key">Отзывов</span><span class="val">${stats.totalCount}</span></div>`;
      
      // Гистограмма распределения
      if (stats.distribution) {
        for (let i = 5; i >= 1; i--) {
          const count = stats.distribution[i] || 0;
          const percent = stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0;
          html += `<div class="rating-bar-row mt-16"><span>${i}</span><span class="rating-stars">★</span><div class="bar"><span style="width:${percent}%"></span></div><span class="text-muted">${count}</span></div>`;
        }
      }
      
      ratingBlock.querySelector('.profile-block').innerHTML = `<div class="block-title">Мой рейтинг</div>` + html;
    })
    .catch(() => {});
}

let yandexMapInstance = null;

function loadYandexScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.ymaps) {
      window.ymaps.ready(resolve);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.async = true;
    script.onload = () => window.ymaps.ready(resolve);
    script.onerror = () => reject(new Error('Не удалось загрузить Яндекс.Карты'));
    document.head.appendChild(script);
  });
}

function initYandexMap(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !window.ymaps) return;
  container.innerHTML = '';
  if (yandexMapInstance) {
    yandexMapInstance.destroy();
    yandexMapInstance = null;
  }
  const orders = (data.orders || []).filter((o) => o.lat != null && o.lng != null);
  const drivers = (data.drivers || []).filter((d) => d.latitude != null && d.longitude != null);
  const center = orders.length ? [orders[0].lat, orders[0].lng] : [55.7558, 37.6173];
  const map = new window.ymaps.Map(containerId, {
    center,
    zoom: 10,
    controls: ['zoomControl', 'typeSelector', 'fullscreenControl'],
  });
  orders.forEach((o) => {
    const placemark = new window.ymaps.Placemark(
      [o.lat, o.lng],
      {
        balloonContent: `<strong>${o.orderNumber || o.id}</strong><br/>${o.toAddress || ''}<br/>${o.status || ''}`,
        iconCaption: o.orderNumber || '',
      },
      { preset: 'islands#orangeDeliveryIcon' }
    );
    map.geoObjects.add(placemark);
  });
  drivers.forEach((d) => {
    const name = [d.user?.firstName, d.user?.lastName].filter(Boolean).join(' ') || 'Водитель';
    const placemark = new window.ymaps.Placemark(
      [Number(d.latitude), Number(d.longitude)],
      {
        balloonContent: `${name}<br/>${d.driverStatus || ''}`,
        iconCaption: name,
      },
      { preset: 'islands#blueAutoIcon' }
    );
    map.geoObjects.add(placemark);
  });
  if (orders.length + drivers.length > 1) {
    const bounds = map.geoObjects.getBounds();
    if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 });
  }
  yandexMapInstance = map;
}

export function loadMapData() {
  Promise.all([api('config').catch(() => ({})), api('map').catch(() => ({ orders: [], drivers: [] }))])
    .then(([config, data]) => {
      const card = document.querySelector('#screen-map .card.mt-16');
      if (card) {
        let html = '';
        (data.orders || []).forEach((o) => {
          html += `<div class="order-item"><div class="route">${o.orderNumber || o.id} · ${o.toAddress || ''}</div><div class="meta">${o.status || ''}</div></div>`;
        });
        card.innerHTML = html || '<p class="card-title">Нет данных для карты</p>';
      }
      const container = document.getElementById('yandex-map-container');
      const apiKey = config.yandexMapsApiKey || window.APP_YANDEX_MAPS_API_KEY || '';
      if (!container) return;
      if (!apiKey) {
        container.innerHTML = '<div class="map-placeholder" style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;">Укажите YANDEX_MAPS_API_KEY в настройках сервера</div>';
        return;
      }
      loadYandexScript(apiKey)
        .then(() => initYandexMap('yandex-map-container', data))
        .catch((err) => {
          container.innerHTML = `<div class="map-placeholder" style="height:100%;display:flex;align-items:center;justify-content:center;color:#f87171;font-size:14px;">${err?.message || 'Ошибка загрузки карты'}</div>`;
        });
    })
    .catch(() => {});
}

function bindOrderForm() {
  document.getElementById('order-submit')?.addEventListener('click', () => {
    const toAddress = getVal('order-to-address');
    const preferredDate = getVal('order-preferred-date');
    if (!toAddress) { alert('Укажите адрес назначения'); return; }
    if (!preferredDate) { alert('Укажите дату подачи'); return; }
    const payload = {
      toAddress,
      preferredDate: preferredDate + 'T12:00:00.000Z',
      preferredTimeFrom: getVal('order-time-from') || undefined,
      preferredTimeTo: getVal('order-time-to') || undefined,
      fromWarehouseId: getVal('order-from-warehouse') || undefined,
      cargoType: document.getElementById('cargo-type-select')?.value || undefined,
      cargoPlaces: parseInt(getVal('order-cargo-places'), 10) || undefined,
      cargoWeight: parseFloat(getVal('order-cargo-weight')) || undefined,
      pickupRequired: getVal('order-pickup') === '1',
      specialConditions: getVal('order-special') || undefined,
      contactName: getVal('order-contact-name') || undefined,
      contactPhone: getVal('order-contact-phone') || undefined,
      price: parseFloat(getVal('order-price')) || undefined,
      paymentType: getVal('order-payment') || undefined,
    };
    const orderId = window._currentOrderId;
    if (orderId) {
      api('orders/' + orderId, { method: 'PUT', json: payload })
        .then((order) => {
          alert('Заявка обновлена: ' + (order.orderNumber || order.id));
          window._currentOrderId = null;
          showScreen('orders');
          loadOrdersList();
        })
        .catch((e) => alert(e?.message || 'Ошибка обновления заявки'));
    } else {
      api('orders', { method: 'POST', json: payload })
        .then((order) => {
          alert('Заявка создана: ' + (order.orderNumber || order.id));
          showScreen('home');
        })
        .catch((e) => alert(e?.message || 'Ошибка создания заявки'));
    }
  });
  document.getElementById('order-cancel')?.addEventListener('click', () => {
    window._currentOrderId = null;
    showScreen('home');
  });
}

function bindProfiles() {
  document.getElementById('profile-client-save')?.addEventListener('click', () => {
    api('clients/profile', {
      method: 'PUT',
      json: {
        companyName: getVal('profile-client-company'),
        companyType: getVal('profile-client-type') || undefined,
        inn: getVal('profile-client-inn') || undefined,
        kpp: getVal('profile-client-kpp') || undefined,
        legalAddress: getVal('profile-client-legal') || undefined,
        email: getVal('profile-client-email') || undefined,
        contactName: getVal('profile-client-contact-name') || undefined,
        contactPhone: getVal('profile-client-contact-phone') || undefined,
        contactEmail: getVal('profile-client-contact-email') || undefined,
      },
    })
      .then(() => alert('Сохранено'))
      .catch((e) => alert(e?.message || 'Ошибка'));
  });
  document.getElementById('profile-client-get-telegram-phone')?.addEventListener('click', () => {
    api('auth/request-telegram-phone', { method: 'POST' })
      .then((res) => {
        alert(res.message || 'Перейдите в чат с ботом и нажмите «Отправить номер телефона».');
        const botName = window.APP_TELEGRAM_BOT_USERNAME || 'drivergo_bot';
        if (typeof Telegram !== 'undefined' && Telegram?.WebApp?.openTelegramLink) {
          Telegram.WebApp.openTelegramLink('https://t.me/' + botName);
        }
      })
      .catch((e) => alert(e?.message || 'Ошибка'));
  });
  document.getElementById('profile-driver-save')?.addEventListener('click', () => {
    api('drivers/profile', {
      method: 'PUT',
      json: {
        fullName: getVal('profile-driver-fullname'),
        email: getVal('profile-driver-email') || undefined,
        vehicleType: getVal('profile-driver-vehicle') || undefined,
        vehiclePlate: getVal('profile-driver-plate') || undefined,
        loadCapacity: getVal('profile-driver-capacity') || undefined,
        licenseNumber: getVal('profile-driver-license') || undefined,
        driverStatus: getVal('profile-driver-status') || undefined,
      },
    })
      .then(() => alert('Сохранено'))
      .catch((e) => alert(e?.message || 'Ошибка'));
  });
  document.getElementById('profile-driver-location')?.addEventListener('click', () => {
    if (!navigator.geolocation) { alert('Геолокация недоступна'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api('drivers/location', { method: 'PUT', json: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } })
          .then(() => alert('Геолокация обновлена'))
          .catch((e) => alert(e?.message || 'Ошибка'));
      },
      () => alert('Не удалось получить координаты')
    );
  });
  document.getElementById('driver-status-update-location')?.addEventListener('click', () => {
    if (!navigator.geolocation) { alert('Геолокация недоступна'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        api('drivers/location', { method: 'PUT', json: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } })
          .then(() => alert('Геолокация обновлена'))
          .catch((e) => alert(e?.message || 'Ошибка'));
      },
      () => alert('Не удалось получить координаты')
    );
  });
}

function bindNavigation() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = 'screen-' + btn.dataset.tab;
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
      document.querySelectorAll('.nav-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (id === 'screen-orders') loadOrdersList();
      if (id === 'screen-profile-client') loadClientProfile();
      if (id === 'screen-profile-driver') loadDriverProfile();
      if (id === 'screen-map') loadMapData();
      if (id === 'screen-order') {
        window._currentOrderId = null;
        loadOrderWarehouses();
      }
    });
  });

  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', function (e) {
      if (this.dataset.orderId) window._currentOrderId = this.dataset.orderId;
      const go = this.dataset.go || el.dataset.go;
      if (go && document.getElementById('screen-' + go)) showScreen(go);
      if (go === 'order-detail' && window._currentOrderId) loadOrderDetail(window._currentOrderId);
    });
  });

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.order-status-btn');
    if (btn && window._currentOrderId) {
      e.preventDefault();
      api('orders/' + window._currentOrderId + '/status', { method: 'POST', json: { status: btn.dataset.status } })
        .then(() => { showScreen('orders'); loadOrdersList(); })
        .catch((err) => alert(err?.message || 'Ошибка'));
    }
  });
}

function bindMisc() {
  document.querySelectorAll('.status-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.status-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const block = document.getElementById('dogruz-block');
      if (block) block.style.display = card.dataset.status === 'dogruz' ? 'block' : 'none';
      
      // Сохраняем статус в профиль водителя
      const status = card.dataset.status;
      api('drivers/profile', {
        method: 'PUT',
        json: { driverStatus: status },
      })
        .then(() => {
          // Статус обновлен
        })
        .catch((e) => {
          alert(e?.message || 'Ошибка обновления статуса');
        });
    });
  });
  document.querySelectorAll('.chips').forEach((container) => {
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  });
  // Переключатель роли на главном экране больше не нужен (роль закреплена при выборе)
  document.querySelectorAll('.tabs-inline').forEach((container) => {
    container.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  });
  document.querySelectorAll('#order-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#order-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('#orders-list .order-item').forEach((item) => {
        const status = item.dataset.status;
        const show =
          filter === 'all' ||
          (filter === 'draft' && status === 'draft') ||
          (filter === 'published' && status === 'published') ||
          (filter === 'taken' && status === 'taken') ||
          (filter === 'progress' && status === 'progress') ||
          (filter === 'completed' && status === 'completed') ||
          (filter === 'cancelled' && status === 'cancelled');
        item.style.display = show ? 'block' : 'none';
      });
    });
  });
  const cargoHints = { pallet: 'Палета стандарт: 120×80×180 см, до 300 кг (16 коробок 60×40×40)', box: 'Короб стандарт: 60×40×40 см, до 20 кг' };
  document.getElementById('cargo-type-select')?.addEventListener('change', function () {
    const v = this.value;
    const hint = document.getElementById('cargo-hint');
    const weight = document.getElementById('order-cargo-weight');
    if (hint) hint.textContent = cargoHints[v] || '';
    if (weight) weight.placeholder = v === 'box' ? 'до 20' : 'до 300';
  });
  document.querySelectorAll('#rating-stars [data-star]').forEach((star) => {
    star.addEventListener('click', function () {
      const n = parseInt(this.dataset.star, 10);
      document.querySelectorAll('#rating-stars [data-star]').forEach((s, i) => {
        s.textContent = i < n ? '★' : '☆';
      });
    });
  });
  
  // Обработчик отправки рейтинга
  document.getElementById('rating-submit')?.addEventListener('click', () => {
    const orderId = window._currentOrderId;
    if (!orderId) { alert('Заявка не выбрана'); return; }
    
    let score = 0;
    document.querySelectorAll('#rating-stars [data-star]').forEach((star, i) => {
      if (star.textContent === '★') score = i + 1;
    });
    if (score === 0) { alert('Выберите оценку'); return; }
    
    const comment = (document.getElementById('rating-comment')?.value || '').trim();
    
    api('ratings', {
      method: 'POST',
      json: { orderId, score, comment: comment || undefined },
    })
      .then(() => {
        alert('Спасибо за оценку!');
        showScreen('orders');
        loadOrdersList();
      })
      .catch((e) => alert(e?.message || 'Ошибка отправки рейтинга'));
  });
}

export function bindAppUI() {
  bindOrderForm();
  bindProfiles();
  bindNavigation();
  bindMisc();
}

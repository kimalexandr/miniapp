/**
 * Переиспользуемый компонент автодополнения адресов через backend-прокси к Yandex Suggest + Geocoder.
 * value/onChange через сам input; при выборе подсказки вызывается onSelectAddress(fullAddress, coordinates).
 */
import { api } from './api.js';

const DEBOUNCE_MS = 400;

/**
 * @param {HTMLInputElement | string} inputElOrId - элемент или id инпута
 * @param {{
 *   onSelectAddress?: (fullAddress: string, coordinates: { lat: number; lng: number } | null) => void;
 *   debounceMs?: number;
 *   placeholder?: string;
 *   bbox?: string;
 * }} options
 * @returns {{ destroy: () => void }} - метод для отписки
 */
export function createAddressInputWithYandexSuggest(inputElOrId, options = {}) {
  const input =
    typeof inputElOrId === 'string'
      ? document.getElementById(inputElOrId)
      : inputElOrId;
  if (!input || input.tagName !== 'INPUT') return { destroy: () => {} };

  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  if (options.placeholder != null) input.placeholder = options.placeholder;

  let debounceTimer = null;
  let lastRequestTime = 0;
  let dropdownEl = null;
  let results = [];
  let selectedIndex = -1;
  let mounted = true;

  function hideDropdown() {
    if (dropdownEl) {
      dropdownEl.remove();
      dropdownEl = null;
    }
    results = [];
    selectedIndex = -1;
  }

  function showDropdown(items, isEmpty) {
    hideDropdown();
    if (!mounted) return;
    results = items;

    const list = document.createElement('div');
    list.className = 'yandex-suggest-list';
    list.setAttribute('role', 'listbox');

    if (isEmpty) {
      const item = document.createElement('div');
      item.className = 'yandex-suggest-item yandex-suggest-item--empty';
      item.textContent = 'Адрес не найден';
      list.appendChild(item);
    } else {
      items.forEach((r, i) => {
        const item = document.createElement('div');
        item.className = 'yandex-suggest-item';
        item.setAttribute('role', 'option');
        item.dataset.index = String(i);
        const text = r.address || r.title || '';
        item.textContent = text;
        item.addEventListener('click', () => selectResult(r));
        list.appendChild(item);
      });
    }

    dropdownEl = document.createElement('div');
    dropdownEl.className = 'yandex-suggest-dropdown';
    dropdownEl.appendChild(list);

    const rect = input.getBoundingClientRect();
    dropdownEl.style.position = 'fixed';
    dropdownEl.style.left = `${rect.left}px`;
    dropdownEl.style.top = `${rect.bottom}px`;
    dropdownEl.style.width = `${Math.max(rect.width, 280)}px`;
    dropdownEl.style.zIndex = '10000';
    document.body.appendChild(dropdownEl);

    selectedIndex = isEmpty ? -1 : 0;
    highlightItem();
  }

  function highlightItem() {
    if (!dropdownEl) return;
    const items = dropdownEl.querySelectorAll('.yandex-suggest-item:not(.yandex-suggest-item--empty)');
    items.forEach((el, i) => {
      el.classList.toggle('yandex-suggest-item--selected', i === selectedIndex);
    });
  }

  function selectResult(r) {
    const text = r.address || r.title || '';
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    hideDropdown();

    const onSelect = options.onSelectAddress;
    if (!onSelect) return;

    api(`yandex/geocode?address=${encodeURIComponent(text)}`)
      .then((data) => {
        if (data && data.fullAddress != null) {
          onSelect(data.fullAddress, data.coordinates || null);
        } else {
          onSelect(text, null);
        }
      })
      .catch((err) => {
        console.warn('[AddressInput] geocode', err);
        onSelect(text, null);
      });
  }

  function fetchSuggest(text) {
    const now = Date.now();
    if (now - lastRequestTime < 200) return;
    lastRequestTime = now;

    let path = `yandex/suggest?q=${encodeURIComponent(text)}&limit=7`;
    if (options.bbox) path += `&bbox=${encodeURIComponent(options.bbox)}`;
    api(path)
      .then((data) => {
        if (!mounted) return;
        const list = data.results || [];
        showDropdown(list, list.length === 0);
      })
      .catch((err) => {
        if (mounted) console.warn('[AddressInput] suggest', err);
      });
  }

  function onInput() {
    const value = input.value.trim();
    clearTimeout(debounceTimer);
    if (!value) {
      hideDropdown();
      return;
    }
    debounceTimer = setTimeout(() => fetchSuggest(value), debounceMs);
  }

  function onKeydown(e) {
    if (!dropdownEl) {
      if (e.key === 'Escape') hideDropdown();
      return;
    }
    const items = dropdownEl.querySelectorAll('.yandex-suggest-item:not(.yandex-suggest-item--empty)');
    if (e.key === 'Escape') {
      e.preventDefault();
      hideDropdown();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
      highlightItem();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
      highlightItem();
      return;
    }
    if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      selectResult(results[selectedIndex]);
    }
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', () => setTimeout(hideDropdown, 150));

  document.addEventListener('click', (e) => {
    if (dropdownEl && !dropdownEl.contains(e.target) && e.target !== input) hideDropdown();
  });

  return {
    destroy() {
      mounted = false;
      clearTimeout(debounceTimer);
      hideDropdown();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeydown);
    },
  };
}

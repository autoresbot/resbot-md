'use strict';

// ═══ Ikon (SVG garis, tanpa library) ═══════════════════
const ICONS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folderPlus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  fileText: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  filePlus: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  video: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3z"/>',
  archive: '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6 9 3 3-3 3M12 15h6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  rename: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  crown: '<path d="m2 18 2-11 5 5 3-7 3 7 5-5 2 11z"/>',
  group: '<circle cx="12" cy="8" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M6 20v-1a6 6 0 0 1 12 0v1M1 20v-1a4 4 0 0 1 4-4M23 20v-1a4 4 0 0 0-4-4"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  puzzle: '<path d="M19 11h-1.5a1.5 1.5 0 1 1 0-3H19V5a1 1 0 0 0-1-1h-3v1.5a1.5 1.5 0 1 1-3 0V4H9a1 1 0 0 0-1 1v3H6.5a1.5 1.5 0 1 0 0 3H8v3h1.5a1.5 1.5 0 1 1 0 3H8v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.9 7L3 21l2-6A8 8 0 1 1 21 12z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
};

function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] || ''; // konstanta di atas, bukan input user
  return svg;
}

function hydrateIcons(root = document) {
  for (const holder of root.querySelectorAll('i[data-icon]')) {
    holder.replaceWith(icon(holder.dataset.icon));
  }
}

// ═══ Helper DOM & API ════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/** Buat elemen DOM. Teks selalu lewat textContent (aman dari XSS). */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value; // checked, rows, dst.
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const iconBtn = (name, title, onclick, cls = '') =>
  el('button', { class: `icon-btn small ${cls}`, title, 'aria-label': title, type: 'button', onclick }, icon(name));

class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function api(method, url, body, options = {}) {
  const headers = { 'X-Dashboard': '1' };
  let payload = body;
  if (body !== undefined && !options.raw) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${url}`, { method, headers, body: payload, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== '/login') {
    showLogin();
    throw new ApiError(401, data);
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const box = $('#toast');
  box.textContent = message;
  box.className = `toast${isError ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('hidden'), isError ? 6000 : 2800);
}

function fail(err) {
  if (err?.status !== 401) toast(err?.message || String(err), true);
}

/** Tombol loading: tampilkan spinner, kunci tombol (anti double klik). */
function setLoading(btn, on, text) {
  btn.classList.toggle('loading', on);
  if ('disabled' in btn && btn.tagName === 'BUTTON') btn.disabled = on;
  btn.querySelector('.spinner')?.classList.toggle('hidden', !on);
  const label = btn.querySelector('.btn-text');
  if (label && text !== undefined) label.textContent = text;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}h`, h && `${h}j`, `${m}m`].filter(Boolean).join(' ');
}

const formatDate = (ms) => (ms ? new Date(ms).toLocaleString('id-ID') : '');

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // mode privat, abaikan
    }
  },
};

/** Tab menyisipkan 2 spasi; Ctrl+<key> memanggil onSave. */
function enhanceEditor(textarea, onSave, key = 's') {
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input'));
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key) {
      e.preventDefault();
      onSave();
    }
  });
}

// ═══ Modal ═══════════════════════════════════════════
function openModal(title, body, actions = [], wide = false) {
  const head = $('#modal-title');
  if (title instanceof Node) head.replaceChildren(title);
  else head.textContent = title;
  $('#modal-body').replaceChildren(body);
  $('#modal-actions').replaceChildren(...actions);
  $('#modal .modal-box').classList.toggle('wide', wide);
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal-body').replaceChildren(); // hentikan audio/video yang sedang diputar
}
$('#modal-close').addEventListener('click', closeModal);
$('#modal').addEventListener('mousedown', (e) => {
  if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeProfileMenu();
    $('#app-view').classList.remove('open');
  }
});

function confirmDialog(title, message, okText = 'Ya', danger = true) {
  return new Promise((resolve) => {
    const done = (value) => {
      closeModal();
      resolve(value);
    };
    openModal(title, el('p', { text: message, style: 'margin:0' }), [
      el('button', { class: 'btn ghost', text: 'Batal', onclick: () => done(false) }),
      el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, text: okText, onclick: () => done(true) }),
    ]);
  });
}

function promptDialog(title, label, value = '') {
  return new Promise((resolve) => {
    const input = el('input', { value });
    const done = (v) => {
      closeModal();
      resolve(v);
    };
    const form = el('form', { onsubmit: (e) => { e.preventDefault(); done(input.value.trim()); } }, [
      el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), input]),
    ]);
    openModal(title, form, [
      el('button', { class: 'btn ghost', text: 'Batal', onclick: () => done(null) }),
      el('button', { class: 'btn primary', text: 'OK', onclick: () => done(input.value.trim()) }),
    ]);
    setTimeout(() => input.focus(), 0);
  });
}

// ═══ Login & profil ══════════════════════════════════
let loginCooldown = null;

function showLogin() {
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  $('#login-password').focus();
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  loadProfile();
  route();
}

async function loadInfo() {
  try {
    const { version } = await api('GET', '/info');
    if (version) {
      $('#login-version').textContent = `CONTROL PANEL · v${version}`;
      $('#sidebar-version').textContent = `RESBOT MD v${version}`;
      document.title = `Resbot MD v${version} · Control Panel`;
    }
  } catch {
    // versi hanya hiasan
  }
}

async function loadProfile() {
  try {
    const p = await api('GET', '/system/profile');
    $('#profile-name').textContent = p.name;
    $('#profile-name-2').textContent = p.name;
    $('#profile-avatar').textContent = (p.name.trim()[0] || 'A').toUpperCase();
    $('#pw-warning').classList.toggle('hidden', !p.passwordGenerated);
  } catch (err) {
    fail(err);
  }
}

/** Terlalu banyak percobaan: kunci tombol dan hitung mundur sesuai server. */
function startLoginCooldown(seconds) {
  const btn = $('#login-btn');
  const errorBox = $('#login-error');
  clearInterval(loginCooldown);
  let left = seconds;
  const tick = () => {
    if (left <= 0) {
      clearInterval(loginCooldown);
      loginCooldown = null;
      errorBox.textContent = '';
      setLoading(btn, false, 'Masuk');
      return;
    }
    errorBox.textContent = `Terlalu banyak percobaan. Tunggu ${left} detik lagi.`;
    setLoading(btn, false, `Tunggu ${left} detik`);
    btn.disabled = true;
    left--;
  };
  tick();
  loginCooldown = setInterval(tick, 1000);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  if (btn.disabled || loginCooldown) return; // anti double klik / Enter berulang

  $('#login-error').textContent = '';
  setLoading(btn, true, 'Memproses...');
  try {
    await api('POST', '/login', { password: $('#login-password').value });
    $('#login-password').value = '';
    setLoading(btn, false, 'Masuk');
    showApp();
  } catch (err) {
    if (err.status === 429 && err.data?.retryAfter) {
      startLoginCooldown(err.data.retryAfter);
    } else {
      setLoading(btn, false, 'Masuk');
      $('#login-error').textContent = err.message;
    }
  }
});

function closeProfileMenu() {
  $('#profile-menu').classList.add('hidden');
}
$('#profile-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#profile-menu').classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.profile')) closeProfileMenu();
});

$('#logout-btn').addEventListener('click', async () => {
  closeProfileMenu();
  await api('POST', '/logout').catch(() => {});
  showLogin();
});

// ═══ Sidebar & navigasi ═══════════════════════════════
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

if (store.get('sidebar') === 'collapsed') $('#app-view').classList.add('collapsed');

$('#menu-btn').addEventListener('click', () => {
  const shell = $('#app-view');
  if (isDesktop()) {
    shell.classList.toggle('collapsed');
    store.set('sidebar', shell.classList.contains('collapsed') ? 'collapsed' : 'open');
  } else {
    shell.classList.toggle('open');
  }
});
$('#backdrop').addEventListener('click', () => $('#app-view').classList.remove('open'));
// Klik menu yang sedang aktif tidak memicu hashchange, jadi drawer ditutup di sini.
$('#nav').addEventListener('click', () => $('#app-view').classList.remove('open'));

const state = { page: null, table: null, dbPage: 1, q: '', data: null, filesPath: '' };
let dashTimer;

// ═══ Form berkategori (dipakai Config & Strings) ═════════
const cloneValue = (v) => (v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Halaman form: chip kategori, field, dan bar simpan. Elemen HTML-nya
 * memakai id `${id}-cats`, `${id}-form`, `${id}-cat-title`, `${id}-savebar`,
 * `${id}-dirty`, `${id}-reset`, `${id}-save`.
 */
function createFormPage({ id, url, renderField, savedMessage, afterSave }) {
  const q = (name) => $(`#${id}-${name}`);
  const page = { categories: [], active: null, original: {}, values: {} };

  page.dirtyKeys = () => Object.keys(page.values).filter((k) => !sameValue(page.values[k], page.original[k]));

  page.load = async (force = false) => {
    if (!force && page.dirtyKeys().length) return page.render(); // jangan timpa isian yang belum disimpan
    try {
      const { categories } = await api('GET', url);
      page.categories = categories;
      page.original = {};
      page.values = {};
      for (const cat of categories) {
        for (const f of cat.fields) {
          if (f.missing) continue;
          page.original[f.key] = cloneValue(f.value);
          page.values[f.key] = cloneValue(f.value);
        }
      }
      if (!categories.some((c) => c.id === page.active)) page.active = categories[0]?.id;
      page.render();
    } catch (err) {
      fail(err);
    }
  };

  page.reset = () => {
    for (const key of Object.keys(page.original)) page.values[key] = cloneValue(page.original[key]);
  };

  page.setValue = (key, value) => {
    page.values[key] = value;
    page.updateBar();
  };

  page.render = () => {
    q('cats').replaceChildren(
      ...page.categories.map((cat) =>
        el('button', {
          class: `chip${cat.id === page.active ? ' active' : ''}`,
          type: 'button',
          'data-cat': cat.id,
          onclick: () => {
            page.active = cat.id;
            page.render();
          },
        }, [icon(cat.icon), cat.title]),
      ),
    );
    const cat = page.categories.find((c) => c.id === page.active);
    q('cat-title').textContent = cat?.title || '';
    q('form').replaceChildren(...(cat ? cat.fields.map((f) => renderField(f, page)) : []));
    page.updateBar();
  };

  /** Tandai field, kategori, dan bar simpan sesuai perubahan yang belum disimpan. */
  page.updateBar = () => {
    const dirty = new Set(page.dirtyKeys());
    q('savebar').classList.toggle('hidden', !dirty.size);
    q('dirty').textContent = `${dirty.size} perubahan belum disimpan`;
    for (const chip of q('cats').querySelectorAll('.chip')) {
      const cat = page.categories.find((c) => c.id === chip.dataset.cat);
      chip.classList.toggle('dirty', !!cat && cat.fields.some((f) => dirty.has(f.key)));
    }
    for (const field of q('form').querySelectorAll('.field')) {
      field.classList.toggle('changed', dirty.has(field.dataset.key));
    }
  };

  q('reset').addEventListener('click', () => {
    page.reset();
    page.render();
  });

  q('save').addEventListener('click', async () => {
    const btn = q('save');
    if (btn.disabled) return;
    const values = {};
    for (const key of page.dirtyKeys()) values[key] = page.values[key];
    btn.disabled = true;
    try {
      await api('PUT', url, { values });
      await page.load(true);
      afterSave?.();
      toast(savedMessage);
    } catch (err) {
      fail(err);
    } finally {
      btn.disabled = false;
    }
  });

  return page;
}

// ═══ Routing ═════════════════════════════════════════
let configPage;
let stringsPage;
let formPages = {};

function route() {
  let name = location.hash.slice(1);
  if (!PAGES[name]) name = 'dashboard';

  // Jangan tinggalkan form dengan perubahan yang belum disimpan tanpa konfirmasi.
  const form = formPages[state.page];
  if (form && name !== state.page && form.dirtyKeys().length) {
    if (!window.confirm('Ada perubahan yang belum disimpan. Tinggalkan halaman?')) {
      history.replaceState(null, '', `#${state.page}`);
      return;
    }
    form.reset();
  }

  state.page = name;
  for (const link of $$('#nav a')) link.classList.toggle('active', link.dataset.page === name);
  for (const page of $$('.page')) page.classList.toggle('hidden', page.id !== `page-${name}`);
  $('#page-title').textContent = PAGES[name].title;
  $('#app-view').classList.remove('open');
  closeProfileMenu();

  clearInterval(dashTimer);
  if (name === 'dashboard') {
    dashTimer = setInterval(() => {
      if (!document.hidden) loadDashboard();
    }, 10000);
  }
  PAGES[name].load();
}
window.addEventListener('hashchange', route);

// ═══ Dashboard ═══════════════════════════════════════
function statCard(iconName, label, value) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-icon' }, icon(iconName)),
    el('div', {}, [el('div', { class: 'stat-label', text: label }), el('div', { class: 'stat-value', text: String(value ?? '-') })]),
  ]);
}

function meter(label, used, total) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  return el('div', { class: 'meter' }, [
    el('div', { class: 'meter-head' }, [el('span', { text: label }), el('span', { text: `${formatBytes(used)} / ${formatBytes(total)}` })]),
    el('div', { class: 'meter-bar' }, el('div', { class: 'meter-fill', style: `width:${pct.toFixed(1)}%` })),
  ]);
}

const kv = (k, v) => el('div', { class: 'kv' }, [el('span', { text: k }), el('span', { text: v })]);
const badge = (on) => el('span', { class: `badge ${on ? 'on' : 'off'}`, text: on ? 'Online' : 'Offline' });

async function loadDashboard() {
  try {
    const s = await api('GET', '/system/status');

    $('#dash-hero').replaceChildren(
      el('div', { class: 'hero-status' }, [
        el('span', { class: `pulse${s.bot.connected ? ' on' : ''}` }),
        el('div', {}, [
          el('div', { class: 'hero-title', text: s.bot.connected ? 'BOT ONLINE' : 'BOT OFFLINE' }),
          el('div', { class: 'hero-sub', text: s.bot.number ? `+${s.bot.number}` : 'Nomor bot belum diatur' }),
        ]),
      ]),
      el('div', { class: 'hero-meta' }, [
        el('div', {}, [el('small', { text: 'Versi' }), el('b', { text: s.version })]),
        el('div', {}, [el('small', { text: 'Uptime' }), el('b', { text: formatDuration(s.uptime) })]),
        el('div', {}, [el('small', { text: 'Server' }), el('b', { text: s.panel ? 'Pterodactyl' : 'Lokal' })]),
      ]),
    );

    $('#dash-stats').replaceChildren(
      statCard('users', 'User', s.stats.users),
      statCard('crown', 'Premium', s.stats.premium),
      statCard('group', 'Grup', s.stats.groups),
      statCard('receipt', 'Sewa', s.stats.sewa),
      statCard('puzzle', 'Plugin', s.stats.plugins),
      statCard('clock', 'Uptime', formatDuration(s.uptime)),
    );

    $('#dash-resource').replaceChildren(
      meter('Memori Bot', s.memory.rss, s.system.total),
      meter('RAM Server', s.system.total - s.system.free, s.system.total),
      kv('CPU', `${s.system.cpus} core · load ${s.system.load.toFixed(2)}`),
      kv('Node.js', s.node),
      kv('Platform', s.platform),
      kv('Port Dashboard', String(s.port)),
    );

    $('#dash-sessions').replaceChildren(
      s.bot.sessions.length
        ? el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, [
            el('thead', {}, el('tr', {}, [el('th', { text: 'Sesi' }), el('th', { text: 'Status' })])),
            el('tbody', {}, s.bot.sessions.map((x) => el('tr', {}, [el('td', { text: x.id }), el('td', {}, badge(x.connected))]))),
          ]))
        : el('div', { class: 'empty' }, [icon('bot'), el('p', { text: 'Belum ada sesi.' })]),
    );
  } catch (err) {
    fail(err);
  }
}

// ═══ Config ══════════════════════════════════════════
function renderConfigField(f, page) {
  const wide = f.type === 'list' || f.type === 'map' || f.type === 'secret';
  const wrap = el('div', { class: `field${wide ? ' wide' : ''}`, 'data-key': f.key });
  wrap.append(el('span', { class: 'field-label', text: f.label }));

  if (f.missing) {
    wrap.append(el('input', { disabled: true, placeholder: 'Tidak ada di config.js' }));
    wrap.append(el('span', { class: 'field-help', text: 'Pengaturan ini belum ada di config.js versi Anda.' }));
    return wrap;
  }

  const value = page.values[f.key];
  const set = (v) => page.setValue(f.key, v);
  let control;

  switch (f.type) {
    case 'boolean': {
      const status = el('span', { class: 'muted', text: value ? 'Aktif' : 'Nonaktif' });
      const input = el('input', {
        type: 'checkbox',
        checked: !!value,
        onchange: (e) => {
          status.textContent = e.target.checked ? 'Aktif' : 'Nonaktif';
          set(e.target.checked);
        },
      });
      control = el('div', { class: 'switch-row' }, [status, el('label', { class: 'switch' }, [input, el('span', { class: 'track' })])]);
      break;
    }
    case 'select':
      control = el('select', { onchange: (e) => set(e.target.value) },
        f.options.map((o) => el('option', { value: o.value, text: o.label })));
      control.value = value ?? '';
      break;
    case 'number':
      control = el('input', {
        type: 'number',
        value: String(value ?? ''),
        min: f.min,
        oninput: (e) => set(e.target.value === '' ? '' : Number(e.target.value)),
      });
      break;
    case 'secret': {
      const input = el('input', { type: 'password', value: value ?? '', autocomplete: 'off', oninput: (e) => set(e.target.value) });
      const toggle = iconBtn('eye', 'Tampilkan', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
      });
      control = el('div', { class: 'input-group' }, [input, toggle]);
      break;
    }
    case 'list':
      control = renderList(f, page);
      break;
    case 'map':
      control = renderMap(f, page);
      break;
    default:
      control = el('input', {
        type: 'text',
        value: value ?? '',
        placeholder: f.placeholder,
        inputmode: f.type === 'phone' ? 'numeric' : undefined,
        maxlength: f.type === 'pairing' ? '9' : undefined,
        oninput: (e) => {
          if (f.type === 'pairing') e.target.value = e.target.value.toUpperCase();
          set(e.target.value);
        },
      });
  }

  wrap.append(control);
  if (f.help) wrap.append(el('span', { class: 'field-help', text: f.help }));
  return wrap;
}

function renderList(f, page) {
  const box = el('div', { class: 'rows' });
  const draw = () => {
    const items = page.values[f.key];
    box.replaceChildren(
      ...items.map((item, i) =>
        el('div', { class: 'row' }, [
          el('input', { value: item, placeholder: f.placeholder, oninput: (e) => { items[i] = e.target.value; page.setValue(f.key, items); } }),
          iconBtn('trash', 'Hapus', () => { items.splice(i, 1); page.setValue(f.key, items); draw(); }, 'danger'),
        ]),
      ),
      el('button', {
        class: 'btn small ghost add',
        type: 'button',
        onclick: () => {
          items.push('');
          page.setValue(f.key, items);
          draw();
          [...box.querySelectorAll('.row input')].pop()?.focus();
        },
      }, [icon('plus'), el('span', { text: 'Tambah' })]),
    );
  };
  draw();
  return box;
}

function renderMap(f, page) {
  // Diedit sebagai daftar pasangan supaya key kosong sementara tidak hilang saat mengetik.
  const box = el('div', { class: 'rows' });
  const pairs = Object.entries(page.values[f.key] || {});
  const sync = () => page.setValue(f.key, Object.fromEntries(pairs.filter(([k]) => k.trim() !== '')));
  const draw = () => {
    box.replaceChildren(
      ...pairs.map((pair, i) =>
        el('div', { class: 'row' }, [
          el('input', { value: pair[0], placeholder: f.keyLabel, oninput: (e) => { pair[0] = e.target.value; sync(); } }),
          el('input', { value: pair[1], placeholder: f.valueLabel, oninput: (e) => { pair[1] = e.target.value; sync(); } }),
          iconBtn('trash', 'Hapus', () => { pairs.splice(i, 1); sync(); draw(); }, 'danger'),
        ]),
      ),
      el('button', { class: 'btn small ghost add', type: 'button', onclick: () => { pairs.push(['', '']); draw(); } }, [icon('plus'), el('span', { text: 'Tambah' })]),
    );
  };
  draw();
  return box;
}

// ═══ Strings ═════════════════════════════════════════
function renderStringField(f, page) {
  const wrap = el('div', { class: 'field wide', 'data-key': f.key });
  const value = page.values[f.key] ?? '';
  const input = el('textarea', {
    class: 'msg',
    rows: Math.max(2, Math.min(10, value.split('\n').length + 1)),
    placeholder: 'Kosong = notifikasi tidak dikirim (untuk pesan handler)',
    oninput: (e) => page.setValue(f.key, e.target.value),
  });
  input.value = value;

  wrap.append(
    el('span', { class: 'field-label', text: f.label }),
    input,
    el('span', { class: 'field-help', text: f.key }),
  );

  if (f.variables.length) {
    // Klik variabel untuk menyisipkannya di posisi kursor.
    wrap.append(el('div', { class: 'vars' }, f.variables.map((v) =>
      el('span', {
        class: 'var',
        text: v,
        title: 'Klik untuk menyisipkan',
        onclick: () => {
          input.focus();
          input.setRangeText(v, input.selectionStart, input.selectionEnd, 'end');
          page.setValue(f.key, input.value);
        },
      }))));
  }
  return wrap;
}

// ═══ Custom (gambar menu & audio) ════════════════════
const AUDIO_INFO = {
  pagi: 'Jam 05:00 – 10:59',
  siang: 'Jam 11:00 – 14:59',
  sore: 'Jam 15:00 – 18:59',
  petang: 'Jam 19:00 – 19:59',
  malam: 'Jam 20:00 – 04:59',
  sahur: 'Pengingat sahur otomatis',
};
let pendingAudioSlot = null; // diisi saat klik "Ganti" pada kartu audio

async function loadCustom() {
  try {
    const data = await api('GET', '/custom');

    const img = $('#img-preview');
    if (data.image.exists) {
      img.src = `/api/custom/image?t=${data.image.mtime}`;
      img.classList.remove('hidden');
      $('#img-meta').textContent = `${formatBytes(data.image.size)} · diubah ${formatDate(data.image.mtime)}`;
    } else {
      img.classList.add('hidden');
      $('#img-meta').textContent = 'Gambar menu belum ada.';
    }

    const select = $('#audio-target');
    if (select.options.length === 1) {
      for (const a of data.audio) select.append(el('option', { value: a.slot, text: `Hanya ${a.slot}` }));
    }

    $('#audio-list').replaceChildren(
      ...data.audio.map((a) =>
        el('div', { class: 'audio-card' }, [
          el('div', { class: 'audio-head' }, [
            el('span', { class: 'ftile' }, icon('music')),
            el('div', {}, [el('b', { text: a.slot }), el('span', { class: 'muted small', text: AUDIO_INFO[a.slot] || '' })]),
            el('button', {
              class: 'btn small',
              type: 'button',
              onclick: () => {
                pendingAudioSlot = a.slot;
                $('#audio-file').click();
              },
            }, [icon('upload'), el('span', { text: 'Ganti' })]),
          ]),
          a.exists
            ? el('audio', { controls: true, preload: 'none', src: `/api/custom/audio/${a.slot}?t=${a.mtime}` })
            : el('span', { class: 'muted small', text: 'Belum ada file.' }),
          a.exists && el('span', { class: 'muted small', text: `${formatBytes(a.size)} · ${formatDate(a.mtime)}` }),
        ]),
      ),
    );
  } catch (err) {
    fail(err);
  }
}

$('#img-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return toast('Ukuran gambar maksimal 10MB.', true);

  const btn = $('#img-upload-btn');
  setLoading(btn, true, 'Mengupload...');
  try {
    await api('POST', '/custom/image', file, { raw: true });
    toast('Gambar menu diganti.');
    loadCustom();
  } catch (err) {
    fail(err);
  } finally {
    setLoading(btn, false, 'Ganti Gambar');
  }
});

async function uploadAudio(file, target) {
  if (file.size > 20 * 1024 * 1024) return toast('Ukuran audio maksimal 20MB.', true);
  if (target === 'all' && !(await confirmDialog('Ganti semua audio', 'File ini akan dipakai untuk semua audio sapaan (pagi sampai sahur). Lanjutkan?', 'Ganti semua', false))) {
    return;
  }
  const btn = $('#audio-upload');
  setLoading(btn, true, 'Memproses...');
  try {
    const res = await api('POST', `/custom/audio?target=${encodeURIComponent(target)}`, file, { raw: true });
    toast(`Audio diganti: ${res.replaced.join(', ')}.`);
    $('#audio-file-name').textContent = 'Pilih file audio';
    loadCustom();
  } catch (err) {
    fail(err);
  } finally {
    setLoading(btn, false, 'Upload');
    btn.disabled = !$('#audio-file').files.length;
  }
}

$('#audio-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (pendingAudioSlot) {
    // Dari tombol "Ganti" di kartu: langsung upload ke slot itu.
    const slot = pendingAudioSlot;
    pendingAudioSlot = null;
    e.target.value = '';
    if (file) uploadAudio(file, slot);
    return;
  }
  $('#audio-file-name').textContent = file ? file.name : 'Pilih file audio';
  $('#audio-upload').disabled = !file;
});

$('#audio-upload').addEventListener('click', async () => {
  const input = $('#audio-file');
  const file = input.files[0];
  if (!file || $('#audio-upload').disabled) return;
  await uploadAudio(file, $('#audio-target').value);
  input.value = '';
  $('#audio-upload').disabled = true;
});

// ═══ Database ════════════════════════════════════════
async function loadTables() {
  try {
    const { tables } = await api('GET', '/db/tables');
    $('#db-tables').replaceChildren(
      ...tables.map((t) =>
        el('li', { class: t.name === state.table ? 'active' : '', 'data-table': t.name, onclick: () => openTable(t.name) }, [
          el('span', { text: t.name }),
          el('small', { text: String(t.count) }),
        ]),
      ),
    );
    if (state.table) loadRows();
  } catch (err) {
    fail(err);
  }
}

function openTable(name) {
  state.table = name;
  state.dbPage = 1;
  state.q = '';
  $('#db-search').value = '';
  for (const li of $$('#db-tables li')) li.classList.toggle('active', li.dataset.table === name);
  $('#db-sql').classList.add('hidden');
  loadRows();
}

function displayValue(value) {
  if (value === null) return el('span', { class: 'null', text: 'NULL' });
  return String(value);
}

async function loadRows() {
  try {
    const params = new URLSearchParams({ page: state.dbPage, q: state.q });
    const data = await api('GET', `/db/tables/${encodeURIComponent(state.table)}?${params}`);
    state.data = data;

    $('#db-empty').classList.add('hidden');
    $('#db-view').classList.remove('hidden');
    $('#db-title').textContent = `${data.table} · ${data.total}`;

    const head = el('tr', {}, [...data.columns.map((c) => el('th', { text: c.pk ? `${c.name} ★` : c.name })), el('th')]);
    const body = data.rows.map((row) =>
      el('tr', {}, [
        ...data.columns.map((c) => el('td', { class: 'cell', title: String(row[c.name] ?? 'NULL') }, displayValue(row[c.name]))),
        el('td', { class: 'actions-cell' }, [
          iconBtn('edit', 'Edit', () => editRow(row)),
          iconBtn('trash', 'Hapus', () => deleteRow(row), 'danger'),
        ]),
      ]),
    );
    if (!body.length) {
      body.push(el('tr', {}, el('td', { colspan: String(data.columns.length + 1), class: 'muted', text: 'Tidak ada data.' })));
    }
    $('#db-table').replaceChildren(el('thead', {}, head), el('tbody', {}, body));

    const pages = Math.max(1, Math.ceil(data.total / data.limit));
    $('#db-pageinfo').textContent = `${data.page} / ${pages}`;
    $('#db-prev').disabled = data.page <= 1;
    $('#db-next').disabled = data.page >= pages;
  } catch (err) {
    fail(err);
  }
}

/** Kolom berisi JSON dirapikan supaya mudah diedit. */
function prettyValue(value) {
  if (value === null || value === undefined) return 'NULL';
  const text = String(value);
  if (/^[\[{]/.test(text.trim())) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // bukan JSON
    }
  }
  return text;
}

function rowForm(row) {
  const inputs = {};
  const fields = state.data.columns.map((c) => {
    const value = row ? prettyValue(row[c.name]) : '';
    const input = el('textarea', {
      class: 'code',
      rows: Math.max(1, Math.min(12, value.split('\n').length)),
      placeholder: c.default !== null ? `default: ${c.default}` : undefined,
    });
    input.value = value;
    inputs[c.name] = input;
    return el('label', { class: 'field' }, [
      el('span', { class: 'field-label', text: `${c.name} · ${c.type || 'ANY'}${c.pk ? ' · PK' : ''}` }),
      input,
    ]);
  });
  const form = el('div', { class: 'rows' }, [
    el('p', { class: 'muted small', style: 'margin:0', text: 'Tulis NULL untuk nilai kosong. Data yang di-cache bot baru berlaku setelah restart.' }),
    ...fields,
  ]);
  return { form, inputs };
}

/** Kembalikan JSON yang tadi dirapikan ke bentuk satu baris seperti aslinya. */
function collectValues(inputs, original) {
  const values = {};
  for (const [name, input] of Object.entries(inputs)) {
    let value = input.value;
    if (original && prettyValue(original[name]) === value) continue;
    if (!original && value === '') continue;
    if (/^[\[{]/.test(value.trim())) {
      try {
        value = JSON.stringify(JSON.parse(value));
      } catch {
        // simpan apa adanya
      }
    }
    values[name] = value;
  }
  return values;
}

function editRow(row) {
  const { form, inputs } = rowForm(row);
  openModal(`Edit · ${state.table}`, form, [
    el('button', { class: 'btn ghost', text: 'Batal', onclick: closeModal }),
    el('button', {
      class: 'btn primary',
      text: 'Simpan',
      onclick: async (e) => {
        const values = collectValues(inputs, row);
        if (!Object.keys(values).length) return closeModal();
        e.target.disabled = true;
        try {
          await api('PUT', `/db/tables/${encodeURIComponent(state.table)}/${row.__rowid}`, { values });
          closeModal();
          toast('Baris disimpan.');
          loadRows();
        } catch (err) {
          e.target.disabled = false;
          fail(err);
        }
      },
    }),
  ], true);
}

function addRow() {
  const { form, inputs } = rowForm(null);
  openModal(`Tambah · ${state.table}`, form, [
    el('button', { class: 'btn ghost', text: 'Batal', onclick: closeModal }),
    el('button', {
      class: 'btn primary',
      text: 'Tambah',
      onclick: async (e) => {
        e.target.disabled = true;
        try {
          await api('POST', `/db/tables/${encodeURIComponent(state.table)}`, { values: collectValues(inputs, null) });
          closeModal();
          toast('Baris ditambahkan.');
          loadTables();
        } catch (err) {
          e.target.disabled = false;
          fail(err);
        }
      },
    }),
  ], true);
}

async function deleteRow(row) {
  const pk = state.data.columns.find((c) => c.pk);
  const label = pk ? row[pk.name] : `rowid ${row.__rowid}`;
  if (!(await confirmDialog('Hapus baris', `Hapus "${label}" dari tabel ${state.table}? Tindakan ini tidak bisa dibatalkan.`, 'Hapus'))) return;
  try {
    await api('DELETE', `/db/tables/${encodeURIComponent(state.table)}/${row.__rowid}`);
    toast('Baris dihapus.');
    loadTables();
  } catch (err) {
    fail(err);
  }
}

let searchTimer;
$('#db-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value;
    state.dbPage = 1;
    loadRows();
  }, 300);
});
$('#db-prev').addEventListener('click', () => { state.dbPage--; loadRows(); });
$('#db-next').addEventListener('click', () => { state.dbPage++; loadRows(); });
$('#db-add').addEventListener('click', addRow);

$('#db-sql-open').addEventListener('click', () => {
  state.table = null;
  for (const li of $$('#db-tables li')) li.classList.remove('active');
  $('#db-empty').classList.add('hidden');
  $('#db-view').classList.add('hidden');
  $('#db-sql').classList.remove('hidden');
  $('#db-sql-input').focus();
});

async function runSql() {
  const box = $('#db-sql-result');
  try {
    const result = await api('POST', '/db/query', { sql: $('#db-sql-input').value });
    if (!result.rows) {
      box.replaceChildren(el('p', { class: 'muted', text: `Berhasil. ${result.changes} baris terpengaruh.` }));
      loadTables();
      return;
    }
    if (!result.rows.length) {
      box.replaceChildren(el('p', { class: 'muted', text: 'Tidak ada hasil.' }));
      return;
    }
    const cols = Object.keys(result.rows[0]);
    box.replaceChildren(
      el('div', { class: 'table-wrap' }, el('table', { class: 'data' }, [
        el('thead', {}, el('tr', {}, cols.map((c) => el('th', { text: c })))),
        el('tbody', {}, result.rows.map((r) => el('tr', {}, cols.map((c) => el('td', { class: 'cell', title: String(r[c] ?? 'NULL') }, displayValue(r[c])))))),
      ])),
    );
    if (result.total > result.rows.length) toast(`Menampilkan ${result.rows.length} dari ${result.total} baris.`);
  } catch (err) {
    if (err.status !== 401) box.replaceChildren(el('pre', { class: 'syntax-error', text: err.message }));
  }
}
$('#db-sql-run').addEventListener('click', runSql);
enhanceEditor($('#db-sql-input'), runSql, 'enter');

// ═══ File manager ════════════════════════════════════
const FILE_TYPES = [
  [/\.(js|mjs|cjs|ts)$/i, 't-js', 'code', 'code'],
  [/\.json$/i, 't-json', 'braces', 'code'],
  [/\.(jpe?g|png|gif|webp)$/i, 't-img', 'image', 'image'],
  [/\.(svg|ico|bmp)$/i, 't-img', 'image', null],
  [/\.(mp3|opus|ogg|m4a|wav)$/i, 't-audio', 'music', 'audio'],
  [/\.(aac|flac)$/i, 't-audio', 'music', null],
  [/\.mp4$/i, 't-video', 'video', 'video'],
  [/\.(mkv|webm|mov|avi)$/i, 't-video', 'video', null],
  [/\.(zip|rar|7z|tar|gz)$/i, 't-zip', 'archive', null],
  [/\.(db|sqlite|db-wal|db-shm)$/i, 't-db', 'database', null],
  [/\.(md|txt|log|csv)$/i, 't-text', 'fileText', 'text'],
  [/(^\.env|\.(env|ya?ml|ini|toml))$/i, 't-env', 'sliders', 'text'],
];

/** Warna, ikon, dan cara membuka sebuah file berdasarkan ekstensinya. */
function fileType(name) {
  for (const [re, cls, iconName, kind] of FILE_TYPES) {
    if (re.test(name)) return { cls, icon: iconName, kind };
  }
  return { cls: '', icon: 'file', kind: 'text' };
}

const extOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
const fileTile = (type) => el('span', { class: `ftile ${type.cls}` }, icon(type.icon));

async function loadFiles(dir = '') {
  try {
    const data = await api('GET', `/files/list?path=${encodeURIComponent(dir)}`);
    state.filesPath = data.path;
    renderCrumbs(data.path);

    const rows = [];
    if (data.path) {
      const parent = data.path.split('/').slice(0, -1).join('/');
      rows.push(el('tr', {}, el('td', { class: 'name', colspan: '4', onclick: () => loadFiles(parent) },
        el('span', { class: 'fname' }, [el('span', { class: 'ftile' }, icon('left')), '..']))));
    }
    for (const entry of data.entries) {
      const isDir = entry.type === 'dir';
      const type = isDir ? { cls: 't-dir', icon: 'folder' } : fileType(entry.name);
      const ext = isDir ? '' : extOf(entry.name);
      rows.push(
        el('tr', {}, [
          el('td', { class: 'name', onclick: () => (isDir ? loadFiles(entry.path) : openFile(entry)) },
            el('span', { class: 'fname' }, [
              fileTile(type),
              entry.name,
              ext && ext.length <= 6 && el('span', { class: `ext ${type.cls}`, text: ext }),
            ])),
          el('td', { class: 'muted', text: isDir ? '' : formatBytes(entry.size) }),
          el('td', { class: 'muted col-mtime', text: formatDate(entry.mtime) }),
          el('td', { class: 'actions-cell' }, [
            !isDir && el('a', { class: 'icon-btn small', title: 'Unduh', href: `/api/files/download?path=${encodeURIComponent(entry.path)}` }, icon('download')),
            iconBtn('rename', 'Ganti nama', () => renameEntry(entry)),
            iconBtn('trash', 'Hapus', () => deleteEntry(entry), 'danger'),
          ]),
        ]),
      );
    }
    if (!data.entries.length) rows.push(el('tr', {}, el('td', { colspan: '4', class: 'muted', text: 'Folder kosong.' })));

    $('#files-table').replaceChildren(
      el('thead', {}, el('tr', {}, [el('th', { text: 'Nama' }), el('th', { text: 'Ukuran' }), el('th', { class: 'col-mtime', text: 'Diubah' }), el('th')])),
      el('tbody', {}, rows),
    );
  } catch (err) {
    fail(err);
  }
}

function renderCrumbs(current) {
  const parts = current ? current.split('/') : [];
  const crumbs = [el('a', { onclick: () => loadFiles('') }, [icon('folder'), 'root'])];
  parts.forEach((part, i) => {
    crumbs.push(el('span', { class: 'muted', text: '/' }));
    crumbs.push(el('a', { text: part, onclick: () => loadFiles(parts.slice(0, i + 1).join('/')) }));
  });
  $('#files-crumbs').replaceChildren(...crumbs);
}

// ─── Editor kode berwarna (textarea transparan di atas <pre> ber-highlight) ───
const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|if|else|for|while|do|import|from|export|default|async|await|new|try|catch|finally|throw|class|extends|typeof|instanceof|of|in|switch|case|break|continue|delete|void|yield)\b)|(\b(?:true|false|null|undefined|this)\b)|([A-Za-z_$][\w$]*(?=\s*\())/g;
const TOKEN_CLASS = ['', 'c', 's', 'n', 'k', 'b', 'f'];
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function highlight(text) {
  let out = '';
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    out += escapeHtml(text.slice(last, m.index));
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    out += `<span class="tk-${TOKEN_CLASS[group]}">${escapeHtml(m[0])}</span>`;
    last = TOKEN_RE.lastIndex;
  }
  return out + escapeHtml(text.slice(last));
}

function codeEditor(content, colored) {
  const gutter = el('div', { class: 'gutter' });
  const pre = el('pre');
  const textarea = el('textarea', { spellcheck: 'false', wrap: 'off', autocapitalize: 'off' });
  textarea.value = content;
  // File sangat besar tidak di-highlight agar tetap ringan.
  const plain = !colored || content.length > 300000;
  const area = el('div', { class: `code-area${plain ? ' plain' : ''}` }, [pre, textarea]);
  const box = el('div', { class: 'code-editor' }, [gutter, area]);

  let lineCount = -1;
  let frame = null;
  const sync = () => {
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
    gutter.scrollTop = textarea.scrollTop;
  };
  const render = () => {
    frame = null;
    const lines = textarea.value.split('\n').length;
    if (lines !== lineCount) {
      lineCount = lines;
      gutter.textContent = `${Array.from({ length: lines }, (_, i) => i + 1).join('\n')}\n\n`;
    }
    if (!plain) pre.innerHTML = `${highlight(textarea.value)}\n\n`; // isi sudah di-escape
    sync();
  };
  textarea.addEventListener('input', () => {
    if (!frame) frame = requestAnimationFrame(render);
  });
  textarea.addEventListener('scroll', sync);
  render();
  return { box, textarea };
}

function fileHeader(path, type) {
  const ext = extOf(path);
  return el('span', { class: 'file-title' }, [
    fileTile(type),
    el('b', { text: path }),
    ext && el('span', { class: `ext ${type.cls}`, text: ext }),
  ]);
}

function openFile(entry) {
  const type = fileType(entry.name);
  if (['image', 'audio', 'video'].includes(type.kind)) return previewFile(entry, type);
  return editFile(entry.path, type);
}

function previewFile(entry, type) {
  const src = `/api/files/raw?path=${encodeURIComponent(entry.path)}`;
  const media =
    type.kind === 'image' ? el('img', { src, alt: entry.name })
    : type.kind === 'audio' ? el('audio', { src, controls: true, autoplay: true })
    : el('video', { src, controls: true });
  openModal(fileHeader(entry.path, type), el('div', { class: 'preview-box' }, [
    media,
    el('span', { class: 'muted small', text: `${formatBytes(entry.size)} · ${formatDate(entry.mtime)}` }),
  ]), [
    el('a', { class: 'btn', href: `/api/files/download?path=${encodeURIComponent(entry.path)}` }, [icon('download'), 'Unduh']),
    el('button', { class: 'btn primary', text: 'Tutup', onclick: closeModal }),
  ], true);
}

async function editFile(path, type) {
  let data;
  try {
    data = await api('GET', `/files/read?path=${encodeURIComponent(path)}`);
  } catch (err) {
    return fail(err);
  }

  const { box, textarea } = codeEditor(data.content, type.kind === 'code');
  // Error sintaks ditampilkan di dalam modal editor, jadi isi editor tidak hilang.
  const errorBox = el('div', { class: 'hidden' });
  const saveBtn = el('button', { class: 'btn primary' }, [el('span', { class: 'spinner hidden' }), el('span', { class: 'btn-text', text: 'Simpan' })]);

  const save = async (force = false) => {
    if (saveBtn.disabled) return;
    setLoading(saveBtn, true, 'Menyimpan...');
    try {
      await api('PUT', '/files/write', { path, content: textarea.value, force });
      // Simpan berhasil: tutup editor otomatis & segarkan daftar file.
      closeModal();
      toast(`${path} disimpan${force ? ' (paksa)' : ''}.`);
      loadFiles(state.filesPath);
    } catch (err) {
      setLoading(saveBtn, false, 'Simpan');
      if (err.status !== 422 || !err.data?.detail) return fail(err);
      errorBox.replaceChildren(
        el('pre', { class: 'syntax-error', text: `Belum disimpan, sintaks JavaScript tidak valid:\n\n${err.data.detail}` }),
        el('div', { class: 'card-head end' }, [
          el('button', { class: 'btn small danger', text: 'Tetap simpan', onclick: () => save(true) }),
        ]),
      );
      errorBox.classList.remove('hidden');
    }
  };
  saveBtn.addEventListener('click', () => save());

  enhanceEditor(textarea, () => save());
  openModal(fileHeader(path, type), el('div', { class: 'rows' }, [errorBox, box]), [
    el('span', { class: 'muted small', style: 'margin-right:auto', text: 'Ctrl+S untuk simpan' }),
    el('button', { class: 'btn ghost', text: 'Tutup', onclick: closeModal }),
    saveBtn,
  ], true);
  // Kursor di awal file. Di HP tidak auto-focus agar keyboard tidak langsung muncul.
  textarea.setSelectionRange(0, 0);
  if (window.matchMedia('(pointer: fine)').matches) {
    setTimeout(() => {
      textarea.focus({ preventScroll: true });
      textarea.scrollTop = 0;
      textarea.scrollLeft = 0;
    }, 0);
  }
}

async function renameEntry(entry) {
  const name = await promptDialog('Ganti nama', 'Nama baru', entry.name);
  if (!name || name === entry.name) return;
  try {
    await api('POST', '/files/rename', { from: entry.path, to: joinPath(state.filesPath, name) });
    toast('Nama diganti.');
    loadFiles(state.filesPath);
  } catch (err) {
    fail(err);
  }
}

async function deleteEntry(entry) {
  const what = entry.type === 'dir' ? 'folder beserta seluruh isinya' : 'file';
  if (!(await confirmDialog('Hapus', `Hapus ${what} "${entry.path}"?`, 'Hapus'))) return;
  try {
    await api('DELETE', `/files?path=${encodeURIComponent(entry.path)}`);
    toast('Dihapus.');
    loadFiles(state.filesPath);
  } catch (err) {
    fail(err);
  }
}

const joinPath = (dir, name) => (dir ? `${dir}/${name}` : name);

$('#files-newfile').addEventListener('click', async () => {
  const name = await promptDialog('File baru', 'Nama file (mis. contoh.js)');
  if (!name) return;
  const path = joinPath(state.filesPath, name);
  try {
    await api('POST', '/files/create', { path });
    await loadFiles(state.filesPath);
    editFile(path, fileType(name));
  } catch (err) {
    fail(err);
  }
});

$('#files-newdir').addEventListener('click', async () => {
  const name = await promptDialog('Folder baru', 'Nama folder');
  if (!name) return;
  try {
    await api('POST', '/files/mkdir', { path: joinPath(state.filesPath, name) });
    loadFiles(state.filesPath);
  } catch (err) {
    fail(err);
  }
});

$('#files-upload').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  for (const file of files) {
    const upload = (overwrite) =>
      api('POST', `/files/upload?${new URLSearchParams({ dir: state.filesPath, name: file.name, overwrite: overwrite ? '1' : '0' })}`, file, { raw: true });
    try {
      await upload(false);
      toast(`${file.name} diupload.`);
    } catch (err) {
      if (err.status === 409 && (await confirmDialog('File sudah ada', `Timpa "${file.name}"?`, 'Timpa'))) {
        try {
          await upload(true);
          toast(`${file.name} ditimpa.`);
        } catch (err2) {
          fail(err2);
        }
      } else if (err.status !== 409) fail(err);
    }
  }
  loadFiles(state.filesPath);
});

// ═══ Log ═════════════════════════════════════════════
async function loadLogs() {
  try {
    const selected = $('#logs-select').value;
    const { files } = await api('GET', '/system/logs');
    $('#logs-select').replaceChildren(...files.map((f) => el('option', { value: f, text: f })));
    $('#logs-select').classList.toggle('hidden', !files.length);
    if (!files.length) {
      $('#logs-content').textContent = 'Belum ada file log. Bagus, berarti belum ada error.';
      return;
    }
    $('#logs-select').value = files.includes(selected) ? selected : files[0];
    await showLog();
  } catch (err) {
    fail(err);
  }
}

async function showLog() {
  try {
    const data = await api('GET', `/system/logs?file=${encodeURIComponent($('#logs-select').value)}`);
    const box = $('#logs-content');
    box.textContent = data.content || '(kosong)';
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    fail(err);
  }
}
$('#logs-select').addEventListener('change', showLog);
$('#logs-refresh').addEventListener('click', loadLogs);

// ═══ Ganti password ══════════════════════════════════
$('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = $('#pw-error');
  errorBox.textContent = '';
  const oldPassword = $('#pw-old').value;
  const newPassword = $('#pw-new').value;
  if (newPassword !== $('#pw-confirm').value) {
    errorBox.textContent = 'Konfirmasi password tidak sama.';
    return;
  }
  const btn = e.target.querySelector('button[type=submit]');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    await api('POST', '/password', { oldPassword, newPassword });
    e.target.reset();
    toast('Password berhasil diganti.');
    loadProfile();
  } catch (err) {
    if (err.status !== 401) errorBox.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// ═══ Mulai ═══════════════════════════════════════════
configPage = createFormPage({
  id: 'config',
  url: '/system/config',
  renderField: renderConfigField,
  savedMessage: 'Config disimpan. Restart bot agar perubahan berlaku.',
  afterSave: loadProfile, // nama owner di profil bisa ikut berubah
});
stringsPage = createFormPage({
  id: 'strings',
  url: '/strings',
  renderField: renderStringField,
  savedMessage: 'Strings disimpan. Restart bot agar perubahan berlaku.',
});
formPages = { config: configPage, strings: stringsPage };

const PAGES = {
  dashboard: { title: 'Dashboard', load: loadDashboard },
  config: { title: 'Config', load: () => configPage.load() },
  custom: { title: 'Custom', load: loadCustom },
  strings: { title: 'Strings', load: () => stringsPage.load() },
  files: { title: 'File Manager', load: () => loadFiles(state.filesPath) },
  database: { title: 'Database', load: loadTables },
  logs: { title: 'Log', load: loadLogs },
  password: { title: 'Ganti Password', load: () => $('#pw-old').focus() },
};

hydrateIcons();
loadInfo();
api('GET', '/session')
  .then(({ loggedIn }) => (loggedIn ? showApp() : showLogin()))
  .catch(showLogin);

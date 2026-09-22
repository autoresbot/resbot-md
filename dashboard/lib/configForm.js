/**
 * configForm.js - Membaca & menulis config.js lewat form (tanpa edit file mentah).
 *
 * Tiap field menunjuk ke satu nilai literal di config.js:
 *   { const: 'APIKEY' }      => baris `const APIKEY = '...';`
 *   { prop: 'status_prefix' } => properti `status_prefix: true,` di objek config
 *
 * Saat menyimpan, HANYA teks literal nilainya yang diganti. Komentar, urutan,
 * dan bagian lain config.js tetap utuh, jadi user yang lebih suka edit manual
 * tidak dirugikan.
 */

import vm from 'vm';

// Karakter kode pairing yang diizinkan WhatsApp (tanpa 0, I, O, U).
const PAIRING_RE = /^[1-9A-HJ-NP-TV-Z]{8}$/;

const ACTIONS = [
  { value: 'kick', label: 'Kick' },
  { value: 'block', label: 'Block' },
  { value: 'both', label: 'Kick + Block' },
];

const SCHEMA = [
  {
    id: 'bot',
    title: 'Bot & Koneksi',
    icon: 'bot',
    fields: [
      { const: 'NOMOR_BOT', label: 'Nomor Bot', type: 'phone', help: 'Format 628xxx, tanpa + atau spasi.' },
      {
        const: 'CONNECTION',
        label: 'Metode Koneksi',
        type: 'select',
        options: [
          { value: 'pairing', label: 'Pairing Code' },
          { value: 'qr', label: 'QR Code' },
        ],
      },
      {
        const: 'PAIRING_CODE',
        label: 'Kode Pairing Custom',
        type: 'pairing',
        placeholder: 'Kosongkan = otomatis',
        help: 'Tepat 8 karakter. Tidak boleh ada 0, I, O, U. Contoh: RESBTMD1',
      },
      {
        const: 'DESTINATION',
        label: 'Bot Merespon Di',
        type: 'select',
        options: [
          { value: 'group', label: 'Grup saja' },
          { value: 'private', label: 'Chat pribadi saja' },
          { value: 'both', label: 'Grup & chat pribadi' },
        ],
      },
      { const: 'RATE_LIMIT', label: 'Jeda Antar Chat (ms)', type: 'number', min: 0, help: '3000 = 3 detik per chat.' },
      { const: 'SIMILARITY', label: 'Saran Command Mirip', type: 'boolean', help: 'Sarankan command yang mirip saat salah ketik.' },
      { prop: 'status_prefix', label: 'Wajib Pakai Prefix', type: 'boolean' },
      { prop: 'prefix', label: 'Daftar Prefix', type: 'list', placeholder: '.' },
      {
        const: 'MODE',
        label: 'Mode',
        type: 'select',
        options: [
          { value: 'production', label: 'Production' },
          { value: 'development', label: 'Development' },
        ],
        help: 'Jangan diubah kecuali Anda developer.',
      },
    ],
  },
  {
    id: 'owner',
    title: 'Owner',
    icon: 'crown',
    fields: [
      { const: 'OWNER_NAME', label: 'Nama Owner', type: 'text' },
      {
        const: 'DATA_OWNER',
        label: 'Data Owner',
        type: 'list',
        placeholder: '628xxx atau 123xxx@lid',
        help: 'Nomor atau LID owner. Tutorial: youtu.be/qrRXPCSFvRo',
      },
      {
        const: 'OWNER_NAMES',
        label: 'Nama Tiap Owner',
        type: 'map',
        keyLabel: 'Nomor / LID',
        valueLabel: 'Nama',
        help: 'Nama yang tampil di command .owner.',
      },
      { const: 'EMAIL', label: 'Email', type: 'text' },
      { const: 'WEBSITE', label: 'Website', type: 'text' },
      { const: 'REGION', label: 'Region', type: 'text' },
    ],
  },
  {
    id: 'api',
    title: 'API Key',
    icon: 'key',
    fields: [
      { const: 'APIKEY', label: 'API Key Autoresbot', type: 'secret', help: 'Dari autoresbot.com (paket apikey).' },
    ],
  },
  {
    id: 'chat',
    title: 'Chat',
    icon: 'chat',
    fields: [
      { const: 'ANTI_CALL', label: 'Anti Call', type: 'boolean', help: 'Blokir yang menelepon bot di chat pribadi.' },
      { const: 'AUTO_READ', label: 'Auto Read', type: 'boolean', help: 'Setiap chat otomatis centang biru.' },
      { const: 'ALWAYS_ONLINE', label: 'Selalu Online', type: 'boolean' },
      { const: 'AUTO_BACKUP', label: 'Auto Backup', type: 'boolean', help: 'Kirim backup data ke owner setiap restart.' },
      { const: 'MIDNIGHT_RESTART', label: 'Restart Jam 12 Malam', type: 'boolean' },
      {
        const: 'PRESENCE_UPDATE',
        label: 'Status Kehadiran',
        type: 'select',
        options: [
          { value: '', label: 'Tidak diatur' },
          { value: 'available', label: 'Available' },
          { value: 'unavailable', label: 'Unavailable' },
          { value: 'composing', label: 'Sedang mengetik' },
          { value: 'recording', label: 'Sedang merekam' },
          { value: 'paused', label: 'Paused' },
        ],
      },
      {
        const: 'TYPE_WELCOME',
        label: 'Tipe Welcome',
        type: 'select',
        options: ['1', '2', '3', '4', '5', '6', 'text', 'random'].map((v) => ({ value: v, label: v })),
      },
      { const: 'BG_WELCOME2', label: 'Background Welcome 2', type: 'text', help: 'URL gambar.' },
      { const: 'STATUS_SCHEDULED', label: 'Jadwal Otomatis', type: 'boolean' },
    ],
  },
  {
    id: 'security',
    title: 'Keamanan Grup',
    icon: 'shield',
    fields: [
      { const: 'BADWORD_WARNING', label: 'Anti Badword: Maks Peringatan', type: 'number', min: 1 },
      { const: 'BADWORD_ACTION', label: 'Anti Badword: Tindakan', type: 'select', options: ACTIONS },
      { const: 'SPAM_LIMIT', label: 'Anti Spam: Batas Pesan', type: 'number', min: 1 },
      { const: 'SPAM_COULDOWN', label: 'Anti Spam: Cooldown (detik)', type: 'number', min: 1 },
      { const: 'SPAM_WARNING', label: 'Anti Spam: Maks Peringatan', type: 'number', min: 1 },
      { const: 'SPAM_ACTION', label: 'Anti Spam: Tindakan', type: 'select', options: ACTIONS },
    ],
  },
  {
    id: 'panel',
    title: 'Panel Pterodactyl',
    icon: 'server',
    fields: [
      { const: 'PANEL_URL', label: 'URL Panel', type: 'text', placeholder: 'https://panel.domain.com' },
      { const: 'PANEL_PLTA', label: 'Application Key (PLTA)', type: 'secret' },
      { const: 'PANEL_DESCRIPTION', label: 'Deskripsi Server', type: 'text' },
      { const: 'PANEL_ID_EGG', label: 'ID Egg', type: 'number', min: 0 },
      { const: 'PANEL_ID_LOCATION', label: 'ID Location', type: 'number', min: 0 },
      { const: 'PANEL_DEFAULT_DISK', label: 'Disk Default (MB)', type: 'number', min: 0, help: '0 = unlimited.' },
      { const: 'PANEL_DEFAULT_CPU', label: 'CPU Default (%)', type: 'number', min: 0 },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: 'dashboard',
    fields: [
      { const: 'DASHBOARD', label: 'Aktifkan Dashboard', type: 'boolean', help: 'Jika dimatikan, dashboard hilang setelah restart.' },
      { const: 'DASHBOARD_PORT', label: 'Port (khusus PC)', type: 'number', min: 1, help: 'Di panel otomatis memakai port server.' },
    ],
  },
];

const fieldId = (field) => field.const || field.prop;
const ALL_FIELDS = new Map(SCHEMA.flatMap((cat) => cat.fields.map((f) => [fieldId(f), f])));

class ConfigFormError extends Error {}

// ─── Mencari literal di source ───────────────────────

/**
 * Cari akhir ekspresi literal mulai dari `start`: berhenti di `;`, `,`,
 * baris baru, atau komentar pada kedalaman 0. String & kurung dilewati utuh.
 */
function scanLiteralEnd(source, start) {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "'" || ch === '"' || ch === '`') {
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      if (depth === 0) break;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      if (depth === 0) break;
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? source.length : close + 2;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) {
      if (depth === 0) break; // penutup objek induk (properti terakhir tanpa koma)
      depth--;
    } else if (depth === 0 && (ch === ';' || ch === ',' || ch === '\n')) break;
    i++;
  }

  let end = i;
  while (end > start && /\s/.test(source[end - 1])) end--;
  return end;
}

function locate(source, field) {
  let re;
  let from = 0;
  if (field.const) {
    re = new RegExp(`^const\\s+${field.const}\\s*=\\s*`, 'm');
  } else {
    // Properti hanya dicari di dalam objek `const config = {`.
    from = source.search(/^const\s+config\s*=\s*\{/m);
    if (from === -1) return null;
    re = new RegExp(`^[ \\t]+${field.prop}\\s*:\\s*`, 'm');
  }
  const match = re.exec(source.slice(from));
  if (!match) return null;
  const start = from + match.index + match[0].length;
  return { start, end: scanLiteralEnd(source, start) };
}

/** Evaluasi literal di sandbox kosong (tanpa akses global/require). */
function evalLiteral(expr) {
  try {
    const value = vm.runInNewContext(`(${expr})`, Object.create(null), { timeout: 50 });
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

// ─── Konversi nilai ──────────────────────────────────

const quote = (s) =>
  `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;

function serialize(value, type) {
  switch (type) {
    case 'boolean':
    case 'number':
      return String(value);
    case 'list':
      return `[${value.map(quote).join(', ')}]`;
    case 'map': {
      const entries = Object.entries(value);
      if (!entries.length) return '{}';
      return `{\n${entries.map(([k, v]) => `  ${quote(k)}: ${quote(v)},`).join('\n')}\n}`;
    }
    default:
      return quote(value);
  }
}

/** Validasi & normalisasi nilai dari browser sesuai tipe field. */
function normalize(field, value) {
  const fail = (msg) => {
    throw new ConfigFormError(`${field.label}: ${msg}`);
  };

  switch (field.type) {
    case 'boolean':
      if (typeof value !== 'boolean') fail('harus aktif/nonaktif.');
      return value;
    case 'number': {
      const num = Number(value);
      if (value === '' || value === null || !Number.isFinite(num)) fail('harus berupa angka.');
      if (field.min !== undefined && num < field.min) fail(`minimal ${field.min}.`);
      return num;
    }
    case 'select':
      if (!field.options.some((o) => o.value === value)) fail('pilihan tidak valid.');
      return value;
    case 'phone': {
      const digits = String(value ?? '').replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) fail('nomor tidak valid (8-15 digit, contoh 628xxx).');
      return digits;
    }
    case 'pairing': {
      const code = String(value ?? '').replace(/-/g, '').trim().toUpperCase();
      if (code && !PAIRING_RE.test(code)) {
        fail('harus tepat 8 karakter, hanya 1-9 dan A-Z tanpa I, O, U.');
      }
      return code;
    }
    case 'list':
      if (!Array.isArray(value)) fail('format daftar tidak valid.');
      return value.map((v) => String(v).trim()).filter(Boolean);
    case 'map': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('format tidak valid.');
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const key = String(k).trim();
        if (key) out[key] = String(v ?? '').trim();
      }
      return out;
    }
    default:
      if (typeof value !== 'string') fail('harus berupa teks.');
      if (value.length > 2000) fail('terlalu panjang.');
      return value.trim();
  }
}

// ─── API modul ───────────────────────────────────────

/** Skema + nilai saat ini. Field yang tidak ada di config.js ditandai missing. */
function readConfigForm(source) {
  return SCHEMA.map((cat) => ({
    id: cat.id,
    title: cat.title,
    icon: cat.icon,
    fields: cat.fields.map((field) => {
      const loc = locate(source, field);
      const value = loc ? evalLiteral(source.slice(loc.start, loc.end)) : undefined;
      return { ...field, key: fieldId(field), value: value ?? null, missing: value === undefined };
    }),
  }));
}

/** Ganti literal satu nilai di source (dipakai juga untuk ganti password). */
function replaceValue(source, field, value) {
  const loc = locate(source, field);
  if (!loc) return null;
  return source.slice(0, loc.start) + serialize(value, field.type) + source.slice(loc.end);
}

/** Terapkan nilai dari form. Hanya key yang ada di SCHEMA yang diterima. */
function applyConfigForm(source, values) {
  let out = source;
  const changed = [];
  for (const [key, raw] of Object.entries(values || {})) {
    const field = ALL_FIELDS.get(key);
    if (!field) throw new ConfigFormError(`Field '${key}' tidak dikenal.`);
    const next = replaceValue(out, field, normalize(field, raw));
    if (next === null) throw new ConfigFormError(`${field.label}: tidak ditemukan di config.js.`);
    if (next !== out) changed.push(key);
    out = next;
  }
  return { source: out, changed };
}

export {
  SCHEMA,
  ConfigFormError,
  readConfigForm,
  applyConfigForm,
  replaceValue,
  locate,
  evalLiteral,
  scanLiteralEnd,
  quote,
};

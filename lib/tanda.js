// ============================================================
// File: lib/tanda.js
// Tanda tangan lisensi (Ed25519), hash PIN, dan aturan paket.
// File di folder lib TIDAK dihitung sebagai fungsi Vercel.
// ============================================================
const crypto = require('crypto');

// ── Tanda tangan ────────────────────────────────────────────
// LICENSE_PRIVATE_KEY = kunci privat Ed25519 (PKCS#8 DER, base64),
// dibuat dengan alat "buat-kunci-lisensi.html". Jangan pernah dibagikan.
let _kunci;
function kunciPrivat() {
  if (_kunci !== undefined) return _kunci;
  const b64 = (process.env.LICENSE_PRIVATE_KEY || '').trim();
  try {
    _kunci = b64 ? crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' }) : null;
  } catch (e) {
    console.error('[tanda] LICENSE_PRIVATE_KEY tidak bisa dibaca');
    _kunci = null;
  }
  return _kunci;
}

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const HARI = 24 * 3600 * 1000;
const MASA_TOKEN_LISENSI = 14 * HARI;   // aplikasi boleh offline 14 hari
const MASA_TOKEN_PENGGUNA = 30 * HARI;  // login offline dengan PIN tersimpan

// Token = base64url(JSON isi) + "." + base64url(tanda tangan)
function tandatangani(isi) {
  const k = kunciPrivat();
  if (!k) return null;
  const data = Buffer.from(JSON.stringify(isi), 'utf8');
  return b64u(data) + '.' + b64u(crypto.sign(null, data, k));
}

function tokenLisensi(license, key, hwid, paket) {
  const now = Date.now();
  return tandatangani({
    t: 'L', v: 1, k: key, h: hwid,
    n: license.customer_name || license.name || '',
    le: paket.expiry_date || null,
    p: paket.cfg,
    iat: now, tx: now + MASA_TOKEN_LISENSI,
  });
}

function tokenPengguna(key, hwid, user) {
  const now = Date.now();
  return tandatangani({
    t: 'U', v: 1, k: key, h: hwid,
    u: { id: user.id, username: user.username, display_name: user.display_name, role: user.role === 'admin' ? 'admin' : 'operator' },
    iat: now, tx: now + MASA_TOKEN_PENGGUNA,
  });
}

// ── Perbandingan aman (tahan serangan waktu) ────────────────
function samaAman(a, b) {
  const ha = crypto.createHash('sha256').update(String(a || '')).digest();
  const hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb) && String(a || '').length > 0;
}

// ── Hash PIN ────────────────────────────────────────────────
// Format baru: "s1$<garam hex>$<hash hex>" (scrypt, garam acak per pengguna).
// Format lama (SHA-256 garam tetap, atau "pin:XXXXXX") masih diterima lalu diganti.
function hashPin(pin) {
  const garam = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pin), garam, 32, { N: 16384, r: 8, p: 1 });
  return 's1$' + garam.toString('hex') + '$' + h.toString('hex');
}
function hashPinLama(pin) {
  return crypto.createHash('sha256').update('zequi_salt_' + pin).digest('hex');
}
// Hasil: { cocok: bool, perluUpgrade: bool }
function cekPin(pin, tersimpan) {
  const s = String(tersimpan || '');
  if (s.startsWith('s1$')) {
    const [, garam, hash] = s.split('$');
    if (!garam || !hash) return { cocok: false };
    const h = crypto.scryptSync(String(pin), Buffer.from(garam, 'hex'), 32, { N: 16384, r: 8, p: 1 }).toString('hex');
    return { cocok: samaAman(h, hash), perluUpgrade: false };
  }
  if (s.startsWith('pin:')) return { cocok: samaAman(pin, s.slice(4)), perluUpgrade: true };
  return { cocok: samaAman(hashPinLama(pin), s), perluUpgrade: true };
}

// ── Perangkat terdaftar ─────────────────────────────────────
function daftarHwid(license) {
  let arr = license.hwids;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
  if (!Array.isArray(arr)) arr = [];
  if (license.hwid && !arr.includes(license.hwid)) arr = [...arr, license.hwid];
  return arr;
}

// ── Paket ───────────────────────────────────────────────────
const PLAN_DEFINITIONS = {
  trial: {
    plan: 'trial', plan_label: 'Trial',
    max_companies: 1, export_enabled: false, print_full: false,
    jurnal_penutup_enabled: false, aset_saldo_menurun: false,
    komparasi_enabled: false, lra_lsal_enabled: false,
    locked_modules: ['komparasi','lra','lsal'], max_devices: 1, trial_days: 14,
  },
  starter: {
    plan: 'starter', plan_label: 'Starter',
    max_companies: 3, export_enabled: true, print_full: true,
    jurnal_penutup_enabled: true, aset_saldo_menurun: false,
    komparasi_enabled: false, lra_lsal_enabled: false,
    locked_modules: ['komparasi','lra','lsal'], max_devices: 1,
  },
  pro: {
    plan: 'pro', plan_label: 'Pro',
    max_companies: 10, export_enabled: true, print_full: true,
    jurnal_penutup_enabled: true, aset_saldo_menurun: true,
    komparasi_enabled: true, lra_lsal_enabled: true,
    locked_modules: [], max_devices: 1,
  },
  enterprise: {
    plan: 'enterprise', plan_label: 'Enterprise',
    max_companies: 9999, export_enabled: true, print_full: true,
    jurnal_penutup_enabled: true, aset_saldo_menurun: true,
    komparasi_enabled: true, lra_lsal_enabled: true,
    locked_modules: [], max_devices: 99,
  },
};

function parseLockedModules(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try { const p = JSON.parse(t); return Array.isArray(p) ? p : []; } catch (e) {}
    }
    return t.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Hitung paket akhir + masa berlaku sebuah lisensi
function hitungPaket(license) {
  const planName = license.plan || 'trial';
  const planDef = PLAN_DEFINITIONS[planName] || PLAN_DEFINITIONS.trial;

  let expiry_date = license.expiry_date || license.expires || null;
  let is_expired = false;
  if (planName === 'trial' && license.activated_at) {
    const trialEnd = new Date(license.activated_at);
    trialEnd.setDate(trialEnd.getDate() + (planDef.trial_days || 14));
    expiry_date = trialEnd.toISOString().split('T')[0];
    is_expired = new Date() > trialEnd;
  } else if (expiry_date) {
    // Berlaku sampai akhir hari tanggal kedaluwarsa
    is_expired = new Date(String(expiry_date).slice(0, 10) + 'T23:59:59Z') < new Date();
  }

  const cfg = { ...planDef };
  ['max_companies', 'max_devices', 'export_enabled', 'print_full', 'jurnal_penutup_enabled',
   'aset_saldo_menurun', 'komparasi_enabled', 'lra_lsal_enabled'].forEach(k => {
    if (license[k] != null) cfg[k] = license[k];
  });
  cfg.locked_modules = license.locked_modules != null
    ? parseLockedModules(license.locked_modules)
    : parseLockedModules(planDef.locked_modules);
  cfg.expiry_date = expiry_date;
  cfg.is_expired = is_expired;
  return { cfg, expiry_date, is_expired };
}

// Lisensi masih boleh dipakai? Hasil: null (boleh) atau pesan alasan
function alasanDitolak(license) {
  if (!license) return 'Kode lisensi tidak ditemukan.';
  if (license.is_active === false || license.status === 'nonaktif')
    return license.revoke_reason || 'Lisensi ini telah dinonaktifkan. Hubungi penjual.';
  const { is_expired, expiry_date } = hitungPaket(license);
  if (is_expired)
    return `Lisensi telah kedaluwarsa sejak ${new Date(expiry_date).toLocaleDateString('id-ID')}. Hubungi penjual untuk perpanjangan.`;
  return null;
}

module.exports = {
  tandatangani, tokenLisensi, tokenPengguna, kunciPrivat,
  samaAman, hashPin, cekPin, daftarHwid,
  PLAN_DEFINITIONS, parseLockedModules, hitungPaket, alasanDitolak,
};

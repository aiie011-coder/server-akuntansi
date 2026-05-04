// ══════════════════════════════════════════════════════════════════
// FILE: api/plan-config.js
// ══════════════════════════════════════════════════════════════════
const { getLicenseByKey, updateLicenseLastSeen } = require('../lib/db');

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

// Normalisasi locked_modules — selalu kembalikan array
function parseLockedModules(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try { const p = JSON.parse(t); return Array.isArray(p) ? p : []; } catch(e) {}
    }
    return t.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, hwid, app } = req.body || {};
  if (!key || !hwid) return res.status(400).json({ error: 'key dan hwid wajib diisi' });

  try {
    const license = await getLicenseByKey(key);

    // Lisensi tidak ditemukan
    if (!license) return res.status(200).json({ valid: false, message: 'Lisensi tidak ditemukan' });

    // Lisensi dinonaktifkan
    if (license.is_active === false) {
      return res.status(200).json({ valid: false, message: license.revoke_reason || 'Lisensi dinonaktifkan' });
    }

    // HWID check — tapi TIDAK blokir jika HWID belum terdaftar sama sekali
    // (user baru / setelah reset). Hanya blokir jika hwid terdaftar DAN tidak cocok.
    const storedHwids = Array.isArray(license.hwids) ? license.hwids :
                        (license.hwid ? [license.hwid] : []);
    const hwidsPopulated = storedHwids.length > 0;
    const hwidsMatch     = storedHwids.includes(hwid);

    if (hwidsPopulated && !hwidsMatch) {
      // Cek apakah masih ada slot perangkat tersisa
      const maxDevices = license.max_devices || 1;
      if (storedHwids.length >= maxDevices) {
        return res.status(200).json({
          valid: false,
          message: 'Lisensi ini terdaftar di perangkat lain. Hubungi penjual untuk reset.'
        });
      }
      // Masih ada slot — izinkan dan update hwids
      const newHwids = [...storedHwids, hwid];
      await updateLicenseLastSeen(key, { hwid, last_seen: new Date().toISOString() });
    } else {
      // Update last_seen saja
      await updateLicenseLastSeen(key, { hwid, last_seen: new Date().toISOString() });
    }

    // Tentukan plan
    const planName = license.plan || 'trial';
    const planDef  = PLAN_DEFINITIONS[planName] || PLAN_DEFINITIONS.trial;

    // Hitung expiry
    let expiry_date = license.expiry_date || license.expires || null;
    let is_expired  = false;
    if (planName === 'trial' && license.activated_at) {
      const trialEnd = new Date(license.activated_at);
      trialEnd.setDate(trialEnd.getDate() + (planDef.trial_days || 14));
      expiry_date = trialEnd.toISOString().split('T')[0];
      is_expired  = new Date() > trialEnd;
    } else if (expiry_date) {
      is_expired = new Date(expiry_date) < new Date();
    }

    // Override per-user dari database (jika admin set manual)
    const customOverrides = {};
    if (license.max_companies != null) customOverrides.max_companies = license.max_companies;
    if (license.max_devices   != null) customOverrides.max_devices   = license.max_devices;
    if (license.export_enabled != null) customOverrides.export_enabled = license.export_enabled;
    if (license.print_full    != null) customOverrides.print_full    = license.print_full;
    if (license.jurnal_penutup_enabled != null) customOverrides.jurnal_penutup_enabled = license.jurnal_penutup_enabled;
    if (license.aset_saldo_menurun     != null) customOverrides.aset_saldo_menurun     = license.aset_saldo_menurun;
    if (license.komparasi_enabled      != null) customOverrides.komparasi_enabled      = license.komparasi_enabled;
    if (license.lra_lsal_enabled       != null) customOverrides.lra_lsal_enabled       = license.lra_lsal_enabled;

    // locked_modules — normalisasi selalu jadi array
    const lockedFromDB = license.locked_modules != null
      ? parseLockedModules(license.locked_modules)
      : null;
    const finalLocked = lockedFromDB ?? parseLockedModules(planDef.locked_modules);

    return res.status(200).json({
      valid: true,
      ...planDef,
      ...customOverrides,
      locked_modules: finalLocked,
      expiry_date,
      is_expired,
      name: license.customer_name || license.name || '',
    });

  } catch (err) {
    console.error('[plan-config] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

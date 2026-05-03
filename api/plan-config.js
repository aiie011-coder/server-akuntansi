// ══════════════════════════════════════════════════════════════════
// FILE: api/plan-config.js
// ══════════════════════════════════════════════════════════════════

const { getLicenseByKey, updateLicenseLastSeen } = require('../lib/db');

const PLAN_DEFINITIONS = {
  trial: {
    plan: 'trial',
    plan_label: 'Trial',
    max_companies: 1,
    export_enabled: false,
    print_full: false,
    jurnal_penutup_enabled: false,
    jurnal_pembalik_enabled: false,
    aset_saldo_menurun: false,
    komparasi_enabled: false,
    lra_lsal_enabled: false,
    locked_modules: ['komparasi', 'lra', 'lsal'],
    max_seats: 1,
    trial_days: 14,
  },
  starter: {
    plan: 'starter',
    plan_label: 'Starter',
    max_companies: 3,
    export_enabled: true,
    print_full: true,
    jurnal_penutup_enabled: true,
    jurnal_pembalik_enabled: true,
    aset_saldo_menurun: false,
    komparasi_enabled: false,
    lra_lsal_enabled: false,
    locked_modules: ['komparasi', 'lra', 'lsal'],
    max_seats: 1,
  },
  pro: {
    plan: 'pro',
    plan_label: 'Pro',
    max_companies: 10,
    export_enabled: true,
    print_full: true,
    jurnal_penutup_enabled: true,
    jurnal_pembalik_enabled: true,
    aset_saldo_menurun: true,
    komparasi_enabled: true,
    lra_lsal_enabled: true,
    locked_modules: [],
    max_seats: 1,
  },
  enterprise: {
    plan: 'enterprise',
    plan_label: 'Enterprise',
    max_companies: 9999,
    export_enabled: true,
    print_full: true,
    jurnal_penutup_enabled: true,
    jurnal_pembalik_enabled: true,
    aset_saldo_menurun: true,
    komparasi_enabled: true,
    lra_lsal_enabled: true,
    locked_modules: [],
    max_seats: 99,
  },
};

// ── Helper: pastikan locked_modules selalu array ──
// Database sering menyimpan array sebagai string JSON ('["lra","lsal"]')
// atau string CSV ("lra,lsal"). Fungsi ini menormalkannya.
function parseLockedModules(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Coba parse sebagai JSON array: '["lra","lsal"]'
    if (trimmed.startsWith('[')) {
      try { 
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch(e) { /* lanjut ke CSV */ }
    }
    // Fallback: CSV "lra,lsal"
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
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

  if (!key || !hwid) {
    return res.status(400).json({ error: 'key dan hwid wajib diisi' });
  }

  try {
    const license = await getLicenseByKey(key);

    if (!license) {
      return res.status(200).json({ valid: false, message: 'Lisensi tidak ditemukan' });
    }

    if (license.hwid && license.hwid !== hwid) {
      return res.status(200).json({
        valid: false,
        message: 'Lisensi ini terdaftar di perangkat lain. Hubungi penjual untuk reset.'
      });
    }

    if (!license.is_active) {
      return res.status(200).json({
        valid: false,
        message: license.revoke_reason || 'Lisensi telah dinonaktifkan.'
      });
    }

    const planName = license.plan || 'trial';
    const planDef  = PLAN_DEFINITIONS[planName] || PLAN_DEFINITIONS.trial;

    let expiry_date = license.expiry_date || null;
    let is_expired  = false;

    if (planName === 'trial' && license.activated_at) {
      const trialEnd = new Date(license.activated_at);
      trialEnd.setDate(trialEnd.getDate() + (planDef.trial_days || 14));
      expiry_date = trialEnd.toISOString().split('T')[0];
      is_expired  = new Date() > trialEnd;
    } else if (expiry_date) {
      is_expired = new Date(expiry_date) < new Date();
    }

    // ── Override dari database — dengan normalisasi locked_modules ──
    const customOverrides = {};
    if (license.max_companies != null) customOverrides.max_companies  = license.max_companies;
    if (license.export_enabled != null) customOverrides.export_enabled = license.export_enabled;
    if (license.print_full     != null) customOverrides.print_full     = license.print_full;

    // FIX: locked_modules wajib dikirim sebagai array, bukan string
    if (license.locked_modules != null) {
      customOverrides.locked_modules = parseLockedModules(license.locked_modules);
    }

    await updateLicenseLastSeen(key, { hwid, last_seen: new Date().toISOString() });

    // FIX: pastikan locked_modules dari planDef juga array (defensif)
    const responseLockedModules = customOverrides.locked_modules 
      ?? parseLockedModules(planDef.locked_modules);

    return res.status(200).json({
      valid: true,
      ...planDef,
      ...customOverrides,
      locked_modules: responseLockedModules,  // selalu array
      expiry_date,
      is_expired,
      name: license.customer_name || '',
    });

  } catch (err) {
    console.error('[plan-config] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

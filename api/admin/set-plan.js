const { getLicenseByKey, updateLicense } = require('../../lib/db');

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

const VALID_PLANS = ['trial', 'starter', 'pro', 'enterprise'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    admin_key,
    license_key,
    plan,
    expiry_date,
    max_companies,
    export_enabled,
    print_full,
    locked_modules,
    is_active,
    revoke_reason,
    notes,
  } = req.body || {};

  if (!admin_key || admin_key !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!license_key) {
    return res.status(400).json({ error: 'license_key wajib diisi' });
  }

  if (plan && !VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: `Plan tidak valid. Pilihan: ${VALID_PLANS.join(', ')}` });
  }

  try {
    const license = await getLicenseByKey(license_key);
    if (!license) {
      return res.status(404).json({ error: 'Lisensi tidak ditemukan' });
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (plan           !== undefined) updates.plan           = plan;
    if (expiry_date    !== undefined) updates.expiry_date    = expiry_date;
    if (max_companies  !== undefined) updates.max_companies  = max_companies;
    if (export_enabled !== undefined) updates.export_enabled = export_enabled;
    if (print_full     !== undefined) updates.print_full     = print_full;
    if (locked_modules !== undefined) updates.locked_modules = locked_modules;
    if (is_active      !== undefined) updates.is_active      = is_active;
    if (revoke_reason  !== undefined) updates.revoke_reason  = revoke_reason;
    if (notes          !== undefined) updates.notes          = notes;

    await updateLicense(license_key, updates);

    return res.status(200).json({
      success: true,
      message: `Paket ${license_key} berhasil diupdate ke ${plan || license.plan}`,
      updated: updates
    });

  } catch (err) {
    console.error('[set-plan] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

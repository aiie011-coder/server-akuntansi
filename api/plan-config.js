// ══════════════════════════════════════════════════════════════════
// FILE: api/plan-config.js
// ══════════════════════════════════════════════════════════════════
const { getLicenseByKey, updateLicenseLastSeen } = require('../lib/db');
const { daftarHwid, hitungPaket, alasanDitolak, tokenLisensi } = require('../lib/tanda');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, hwid } = req.body || {};
  if (!key || !hwid || typeof key !== 'string' || typeof hwid !== 'string')
    return res.status(400).json({ error: 'key dan hwid wajib diisi' });

  try {
    const cleanKey = key.trim().toUpperCase();
    const license = await getLicenseByKey(cleanKey);

    if (!license) return res.status(200).json({ valid: false, message: 'Lisensi tidak ditemukan' });
    if (license.is_active === false) {
      return res.status(200).json({ valid: false, message: license.revoke_reason || 'Lisensi dinonaktifkan' });
    }

    // Perangkat harus sudah diaktivasi lewat /api/activate
    if (!daftarHwid(license).includes(hwid)) {
      return res.status(200).json({
        valid: false,
        message: 'Perangkat ini belum terdaftar untuk lisensi ini. Aktivasi ulang atau hubungi penjual untuk reset.'
      });
    }

    await updateLicenseLastSeen(cleanKey, { last_seen: new Date().toISOString() });

    const paket = hitungPaket(license);
    // Token hanya diberikan bila lisensi masih berlaku
    const token = alasanDitolak(license) ? null : tokenLisensi(license, cleanKey, hwid, paket);

    return res.status(200).json({
      valid: true,
      ...paket.cfg,
      expiry_date: paket.expiry_date,
      is_expired: paket.is_expired,
      name: license.customer_name || license.name || '',
      token,
    });

  } catch (err) {
    console.error('[plan-config] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

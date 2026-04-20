// File: api/admin/delete-license.js
const { getLicenseByKey, query } = require('../../lib/db');

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { admin_key, license_key } = req.body || {};

  if (!admin_key || admin_key !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!license_key) {
    return res.status(400).json({ error: 'license_key wajib diisi' });
  }

  try {
    const license = await getLicenseByKey(license_key);
    if (!license) {
      return res.status(404).json({ error: 'Lisensi tidak ditemukan' });
    }

    await query('DELETE', 'licenses', { key: license_key });

    return res.status(200).json({
      success: true,
      message: `Lisensi ${license_key} berhasil dihapus`,
    });

  } catch (err) {
    console.error('[delete-license] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

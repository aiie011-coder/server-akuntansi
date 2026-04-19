// File: api/admin/create-license.js
const { query } = require('../../lib/db');

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    admin_key, key, customer_name, customer_email,
    plan, expiry_date, notes
  } = req.body || {};

  if (!admin_key || admin_key !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!key || !customer_name) {
    return res.status(400).json({ error: 'key dan customer_name wajib diisi' });
  }

  try {
    const row = {
      key,
      customer_name,
      customer_email:  customer_email || null,
      plan:            plan || 'trial',
      expiry_date:     expiry_date || null,
      notes:           notes || null,
      is_active:       true,
      updated_at:      new Date().toISOString(),
    };

    const data = await query('POST', 'licenses', row);

    return res.status(200).json({
      success: true,
      key,
      message: `Lisensi ${key} berhasil dibuat`
    });

  } catch (err) {
    console.error('[create-license] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

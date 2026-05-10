// File: api/users.js
// Endpoint: POST /api/users
// Ambil daftar pengguna aktif berdasarkan kode lisensi

const { getLicenseByKey } = require('../lib/db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, hwid, app } = req.body || {};

  if (!key || typeof key !== 'string')
    return res.status(400).json({ error: 'key wajib diisi' });
  if (app !== 'zequi-v1')
    return res.status(400).json({ error: 'App tidak dikenal' });

  try {
    // Validasi lisensi dulu
    const license = await getLicenseByKey(key.trim().toUpperCase());
    if (!license || license.is_active === false)
      return res.status(403).json({ error: 'Lisensi tidak valid' });

    // Ambil daftar user aktif — TANPA pin_hash (jangan kirim ke client)
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/license_users?license_key=eq.${encodeURIComponent(key.trim().toUpperCase())}&is_active=eq.true&select=id,username,display_name,role&order=display_name.asc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const users = await resp.json();
    return res.status(200).json({ users: users || [] });

  } catch (err) {
    console.error('[users] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

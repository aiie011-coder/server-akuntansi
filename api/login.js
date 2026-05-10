// File: api/login.js
// Endpoint: POST /api/login
// Verifikasi username + PIN pengguna

const { getLicenseByKey } = require('../lib/db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Hash PIN pakai SHA-256 bawaan Node.js — tidak perlu install bcrypt
const crypto = require('crypto');

function hashPin(pin) {
  return crypto.createHash('sha256').update('zequi_salt_' + pin).digest('hex');
}

async function getUser(licenseKey, username) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/license_users?license_key=eq.${encodeURIComponent(licenseKey)}&username=eq.${encodeURIComponent(username)}&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
    }
  );
  const rows = await resp.json();
  return rows?.[0] || null;
}

async function updatePinHash(licenseKey, username, newHash) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/license_users?license_key=eq.${encodeURIComponent(licenseKey)}&username=eq.${encodeURIComponent(username)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin_hash: newHash }),
    }
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, username, pin, hwid, app } = req.body || {};

  if (!key || !username || !pin)
    return res.status(400).json({ valid: false, message: 'key, username, dan pin wajib diisi.' });
  if (app !== 'zequi-v1')
    return res.status(400).json({ valid: false, message: 'App tidak dikenal.' });
  if (!/^\d{6}$/.test(pin))
    return res.status(400).json({ valid: false, message: 'PIN harus 6 digit angka.' });

  try {
    const cleanKey = key.trim().toUpperCase();

    // Validasi lisensi
    const license = await getLicenseByKey(cleanKey);
    if (!license || license.is_active === false)
      return res.json({ valid: false, message: 'Lisensi tidak valid atau tidak aktif.' });

    // Ambil data user (termasuk pin_hash)
    const user = await getUser(cleanKey, username.trim().toLowerCase());
    if (!user || !user.is_active)
      return res.json({ valid: false, message: 'Pengguna tidak ditemukan atau tidak aktif.' });

    const inputHash = hashPin(pin);

    // Format sementara "pin:XXXXXX" — hash otomatis saat login pertama
    if (user.pin_hash && user.pin_hash.startsWith('pin:')) {
      const plainPin = user.pin_hash.replace('pin:', '');
      if (pin !== plainPin) {
        return res.json({ valid: false, message: 'PIN salah. Coba lagi.' });
      }
      // Login pertama berhasil — simpan hash yang aman
      await updatePinHash(cleanKey, username.trim().toLowerCase(), inputHash);
    } else {
      // Verifikasi hash normal
      if (inputHash !== user.pin_hash) {
        return res.json({ valid: false, message: 'PIN salah. Coba lagi.' });
      }
    }

    return res.json({
      valid: true,
      message: `Selamat datang, ${user.display_name || user.username}!`,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });

  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

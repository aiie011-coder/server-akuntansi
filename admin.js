// ============================================================
// AkuntansiPro — Admin API Endpoint
// File: api/admin.js
// Semua operasi admin: list, create, update, delete lisensi
// ============================================================

import {
  getLicense, saveLicense, updateLicenseStatus,
  resetLicenseHWID, listAllLicenses, deleteLicense
} from '../lib/db.js';

// Password admin — GANTI DENGAN PASSWORD ANDA!
// Gunakan environment variable di Vercel: ADMIN_SECRET
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ganti-password-ini-sekarang';

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let s = 0; s < 4; s++) {
    if (s > 0) key += '-';
    for (let i = 0; i < 5; i++) key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

function getExpiry(type) {
  if (type === 'lifetime') return null;
  const d = new Date();
  if (type === '1year') d.setFullYear(d.getFullYear() + 1);
  if (type === '6month') d.setMonth(d.getMonth() + 6);
  if (type === 'trial') d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, key, data } = req.body || {};

  try {
    switch (action) {

      // ── List semua lisensi ──
      case 'list': {
        const licenses = await listAllLicenses();
        return res.json({ success: true, licenses });
      }

      // ── Generate lisensi baru ──
      case 'generate': {
        const { name, type = 'lifetime', note = '', count = 1 } = data || {};
        const generated = [];
        for (let i = 0; i < Math.min(count, 50); i++) {
          const newKey = generateKey();
          const licData = {
            key: newKey,
            name: name || 'Tidak diisi',
            type,
            note,
            status: 'unused',
            hwid: null,
            activated_at: null,
            expires: getExpiry(type),
            created: new Date().toISOString()
          };
          await saveLicense(newKey, licData);
          generated.push(newKey);
        }
        return res.json({ success: true, keys: generated });
      }

      // ── Update status lisensi ──
      case 'updateStatus': {
        if (!key) return res.status(400).json({ error: 'key required' });
        await updateLicenseStatus(key, data.status);
        return res.json({ success: true });
      }

      // ── Reset HWID (izinkan pindah PC) ──
      case 'resetHWID': {
        if (!key) return res.status(400).json({ error: 'key required' });
        await resetLicenseHWID(key);
        return res.json({ success: true });
      }

      // ── Hapus lisensi ──
      case 'delete': {
        if (!key) return res.status(400).json({ error: 'key required' });
        await deleteLicense(key);
        return res.json({ success: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

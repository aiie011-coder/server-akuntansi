// File: api/admin-action.js
// Endpoint khusus untuk admin panel yang sudah login via cookie
// Tidak butuh Bearer token — cukup session cookie

import {
  getLicense, saveLicense, updateLicenseStatus,
  resetLicenseHWID, listAllLicenses, deleteLicense
} from '../lib/db.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validasi session cookie
  const cookie = req.headers.cookie || '';
  const sessionMatch = cookie.match(/akpro_session=([^;]+)/);
  const expectedToken = Buffer.from(ADMIN_SECRET).toString('base64');
  if (!sessionMatch || sessionMatch[1] !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, key, data } = req.body || {};

  try {
    switch (action) {
      case 'list': {
        const licenses = await listAllLicenses();
        return res.json({ success: true, licenses });
      }
      case 'generate': {
        const { name, type = 'lifetime', note = '', count = 1 } = data || {};
        const generated = [];
        for (let i = 0; i < Math.min(count, 20); i++) {
          const newKey = generateKey();
          await saveLicense({ key: newKey, name: name || 'Tidak diisi', type, note, expires: getExpiry(type) });
          generated.push(newKey);
        }
        return res.json({ success: true, keys: generated });
      }
      case 'updateStatus': {
        if (!key) return res.status(400).json({ error: 'key required' });
        await updateLicenseStatus(key, data.status);
        return res.json({ success: true });
      }
      case 'resetHWID': {
        if (!key) return res.status(400).json({ error: 'key required' });
        await resetLicenseHWID(key);
        return res.json({ success: true });
      }
      case 'delete': {
        if (!key) return res.status(400).json({ error: 'key required' });
        await deleteLicense(key);
        return res.json({ success: true });
      }
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('Admin action error:', err);
    return res.status(500).json({ error: err.message });
  }
}

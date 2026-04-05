// ============================================================
// AkuntansiPro — License Activation Endpoint
// File: api/activate.js
// Deploy ke: vercel.com (gratis)
// ============================================================

import { getLicense, activateLicense } from '../lib/db.js';

export default async function handler(req, res) {
  // CORS headers — izinkan dari mana saja (file:// dan app)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { key, hwid, app } = req.body || {};

    // Validasi input dasar
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ valid: false, message: 'Kode lisensi tidak boleh kosong.' });
    }
    if (!hwid || typeof hwid !== 'string') {
      return res.status(400).json({ valid: false, message: 'Device ID tidak valid.' });
    }

    const cleanKey = key.trim().toUpperCase();

    // Ambil lisensi dari database
    const license = await getLicense(cleanKey);

    if (!license) {
      return res.json({ valid: false, message: 'Kode lisensi tidak ditemukan. Periksa kembali kode Anda.' });
    }

    if (license.status === 'nonaktif') {
      return res.json({ valid: false, message: 'Lisensi ini telah dinonaktifkan. Hubungi penjual.' });
    }

    // Cek kadaluarsa
    if (license.expires && new Date(license.expires) < new Date()) {
      return res.json({ valid: false, message: `Lisensi telah kadaluarsa sejak ${new Date(license.expires).toLocaleDateString('id-ID')}.` });
    }

    // Cek HWID — apakah sudah terdaftar di perangkat lain?
    if (license.hwid && license.hwid !== hwid) {
      return res.json({
        valid: false,
        message: 'Lisensi ini sudah terdaftar di perangkat lain. Hubungi penjual untuk reset perangkat.'
      });
    }

    // Aktivasi pertama kali — simpan HWID
    if (!license.hwid) {
      await activateLicense(cleanKey, hwid);
    }

    return res.json({
      valid: true,
      message: `Selamat datang, ${license.name || 'Pengguna'}! Lisensi berhasil diaktivasi.`,
      expires: license.expires || null,
      name: license.name || '',
      type: license.type || 'lifetime'
    });

  } catch (err) {
    console.error('Activation error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
}

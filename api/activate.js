// File: api/activate.js
const { getLicense, activateLicense } = require('../lib/db');
const { daftarHwid, hitungPaket, alasanDitolak, tokenLisensi } = require('../lib/tanda');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { key, hwid } = req.body || {};

    if (!key || typeof key !== 'string')
      return res.status(400).json({ valid: false, message: 'Kode lisensi tidak boleh kosong.' });
    if (!hwid || typeof hwid !== 'string' || hwid.length > 64)
      return res.status(400).json({ valid: false, message: 'Device ID tidak valid.' });

    const cleanKey = key.trim().toUpperCase();
    const license  = await getLicense(cleanKey);

    const alasan = alasanDitolak(license);
    if (alasan) return res.json({ valid: false, message: alasan });

    const currentHwids = daftarHwid(license);
    const maxDevices   = license.max_devices || 1;
    const customerName = license.customer_name || license.name || 'Pengguna';

    // Perangkat baru → daftarkan bila masih ada slot
    let baru = false;
    if (!currentHwids.includes(hwid)) {
      if (currentHwids.length >= maxDevices) {
        if (maxDevices === 1)
          return res.json({ valid: false, message: 'Lisensi ini sudah terdaftar di perangkat lain. Hubungi penjual untuk reset.' });
        return res.json({ valid: false, message: `Lisensi ini sudah mencapai batas ${maxDevices} perangkat. Hubungi penjual untuk upgrade.` });
      }
      try {
        await activateLicense(cleanKey, hwid);
        baru = true;
      } catch (err) {
        if (err.message.startsWith('DEVICE_LIMIT:')) {
          const limit = err.message.split(':')[1];
          return res.json({ valid: false, message: `Lisensi ini sudah mencapai batas ${limit} perangkat. Hubungi penjual untuk upgrade.` });
        }
        throw err;
      }
    }

    // Trial dihitung sejak aktivasi pertama
    const paket = hitungPaket(baru && !license.activated_at ? { ...license, activated_at: new Date().toISOString() } : license);

    return res.json({
      valid:       true,
      message:     baru ? `Selamat datang, ${customerName}! Lisensi berhasil diaktivasi.` : `Selamat datang kembali, ${customerName}!`,
      name:        customerName,
      plan:        license.plan || 'trial',
      expiry_date: paket.expiry_date,
      type:        license.type || 'lifetime',
      devices:     currentHwids.length + (baru ? 1 : 0),
      max_devices: maxDevices,
      token:       tokenLisensi(license, cleanKey, hwid, paket),
    });

  } catch (err) {
    console.error('Activation error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

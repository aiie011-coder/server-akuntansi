// File: api/activate.js
const { getLicense, activateLicense } = require('../lib/db');

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
    if (!hwid || typeof hwid !== 'string')
      return res.status(400).json({ valid: false, message: 'Device ID tidak valid.' });

    const cleanKey = key.trim().toUpperCase();
    const license = await getLicense(cleanKey);

    if (!license)
      return res.json({ valid: false, message: 'Kode lisensi tidak ditemukan. Periksa kembali kode Anda.' });

    if (license.status === 'nonaktif' || license.is_active === false)
      return res.json({ valid: false, message: license.revoke_reason || 'Lisensi ini telah dinonaktifkan. Hubungi penjual.' });

    if (license.expires && new Date(license.expires) < new Date())
      return res.json({ valid: false, message: `Lisensi telah kadaluarsa sejak ${new Date(license.expires).toLocaleDateString('id-ID')}.` });

    const currentHwids = Array.isArray(license.hwids) ? license.hwids :
                         (license.hwid ? [license.hwid] : []);
    const maxDevices = license.max_devices || 1;

    // Helper: normalisasi locked_modules selalu array
    function parseLockedModules(value) {
      if (Array.isArray(value)) return value;
      if (!value) return [];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.startsWith('[')) {
          try { const p = JSON.parse(trimmed); return Array.isArray(p) ? p : []; } catch(e) {}
        }
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    }

    // Data plan yang akan disertakan di semua response valid
    const planData = {
      plan:        license.plan        || 'trial',
      expiry_date: license.expiry_date || license.expires || null,
    };

    if (currentHwids.includes(hwid)) {
      return res.json({
        valid: true,
        message: `Selamat datang kembali, ${license.customer_name || license.name || 'Pengguna'}!`,
        expires: license.expires || null,
        name: license.customer_name || license.name || '',
        type: license.type || 'lifetime',
        devices: currentHwids.length,
        max_devices: maxDevices,
        ...planData,
      });
    }

    if (maxDevices === 1 && currentHwids.length >= 1) {
      return res.json({
        valid: false,
        message: 'Lisensi ini sudah terdaftar di perangkat lain. Hubungi penjual untuk reset.'
      });
    }

    try {
      await activateLicense(cleanKey, hwid);
    } catch (err) {
      if (err.message.startsWith('DEVICE_LIMIT:')) {
        const limit = err.message.split(':')[1];
        return res.json({
          valid: false,
          message: `Lisensi Tim ini sudah mencapai batas ${limit} perangkat. Hubungi penjual untuk upgrade.`
        });
      }
      throw err;
    }

    const newCount = currentHwids.length + 1;

    return res.json({
      valid: true,
      message: `Selamat datang, ${license.customer_name || license.name || 'Pengguna'}! Lisensi berhasil diaktivasi.`,
      expires: license.expires || null,
      name: license.customer_name || license.name || '',
      type: license.type || 'lifetime',
      devices: newCount,
      max_devices: maxDevices,
      ...planData,
    });

  } catch (err) {
    console.error('Activation error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

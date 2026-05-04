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
    const license  = await getLicense(cleanKey);

    if (!license)
      return res.json({ valid: false, message: 'Kode lisensi tidak ditemukan. Periksa kembali kode Anda.' });

    if (license.is_active === false || license.status === 'nonaktif')
      return res.json({ valid: false, message: license.revoke_reason || 'Lisensi ini telah dinonaktifkan. Hubungi penjual.' });

    const expireDate = license.expiry_date || license.expires;
    if (expireDate && new Date(expireDate) < new Date())
      return res.json({ valid: false, message: `Lisensi telah kadaluarsa sejak ${new Date(expireDate).toLocaleDateString('id-ID')}.` });

    const currentHwids = Array.isArray(license.hwids) ? license.hwids :
                         (license.hwid ? [license.hwid] : []);
    const maxDevices   = license.max_devices || 1;
    const customerName = license.customer_name || license.name || 'Pengguna';

    // Sudah terdaftar di perangkat ini — langsung izinkan
    if (currentHwids.includes(hwid)) {
      return res.json({
        valid:       true,
        message:     `Selamat datang kembali, ${customerName}!`,
        name:        customerName,
        plan:        license.plan || 'trial',
        expiry_date: license.expiry_date || license.expires || null,
        type:        license.type || 'lifetime',
        devices:     currentHwids.length,
        max_devices: maxDevices,
      });
    }

    // Cek batas perangkat
    if (currentHwids.length >= maxDevices) {
      if (maxDevices === 1) {
        return res.json({ valid: false, message: 'Lisensi ini sudah terdaftar di perangkat lain. Hubungi penjual untuk reset.' });
      }
      return res.json({ valid: false, message: `Lisensi ini sudah mencapai batas ${maxDevices} perangkat. Hubungi penjual untuk upgrade.` });
    }

    // Aktivasi perangkat baru
    try {
      await activateLicense(cleanKey, hwid);
    } catch (err) {
      if (err.message.startsWith('DEVICE_LIMIT:')) {
        const limit = err.message.split(':')[1];
        return res.json({ valid: false, message: `Lisensi ini sudah mencapai batas ${limit} perangkat. Hubungi penjual untuk upgrade.` });
      }
      throw err;
    }

    return res.json({
      valid:       true,
      message:     `Selamat datang, ${customerName}! Lisensi berhasil diaktivasi.`,
      name:        customerName,
      plan:        license.plan || 'trial',
      expiry_date: license.expiry_date || license.expires || null,
      type:        license.type || 'lifetime',
      devices:     currentHwids.length + 1,
      max_devices: maxDevices,
    });

  } catch (err) {
    console.error('Activation error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

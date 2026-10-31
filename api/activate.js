// File: api/activate.js
const { getLicense, activateLicense, updateLicense } = require('../lib/db');
const { daftarHwid, daftarHwidPimpinan, hitungPaket, alasanDitolak, tokenLisensi } = require('../lib/tanda');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { key, hwid, peran } = req.body || {};
    const untukPimpinan = peran === 'pimpinan';

    if (!key || typeof key !== 'string')
      return res.status(400).json({ valid: false, message: 'Kode lisensi tidak boleh kosong.' });
    if (!hwid || typeof hwid !== 'string' || hwid.length > 64)
      return res.status(400).json({ valid: false, message: 'Device ID tidak valid.' });

    const cleanKey = key.trim().toUpperCase();
    const license  = await getLicense(cleanKey);

    const alasan = alasanDitolak(license);
    if (alasan) return res.json({ valid: false, message: alasan });

    const currentHwids = daftarHwid(license);
    const hwidPimpinan = daftarHwidPimpinan(license);
    const cfg          = hitungPaket(license).cfg;
    const maxDevices   = license.max_devices || 1;
    const maxPimpinan  = Math.max(0, Math.min(cfg.max_pimpinan || 0, maxDevices - 1)); // minimal 1 slot kerja
    const customerName = license.customer_name || license.name || 'Pengguna';

    // Perangkat baru → daftarkan bila masih ada slot.
    // Slot Pimpinan disisihkan dari max_devices: perangkat kerja hanya boleh memakai sisanya.
    let baru = false;
    if (!currentHwids.includes(hwid)) {
      const kerja = currentHwids.length - hwidPimpinan.length;
      if (untukPimpinan) {
        if (!maxPimpinan)
          return res.json({ valid: false, message: 'Perangkat Pimpinan tersedia di paket Pro. Hubungi penjual untuk upgrade.' });
        if (hwidPimpinan.length >= maxPimpinan || currentHwids.length >= maxDevices)
          return res.json({ valid: false, message: `Perangkat Pimpinan sudah terpakai (${hwidPimpinan.length} dari ${maxPimpinan}). Hubungi penjual untuk menambah atau mereset perangkat.` });
      } else if (kerja >= maxDevices - maxPimpinan || currentHwids.length >= maxDevices) {
        const sisaPimpinan = maxPimpinan - hwidPimpinan.length;
        if (sisaPimpinan > 0 && currentHwids.length < maxDevices)
          return res.json({ valid: false, message: 'Perangkat kerja untuk lisensi ini sudah terpakai. Slot yang tersisa khusus Pimpinan: centang "Perangkat ini untuk Pimpinan" bila perangkat ini milik pimpinan.' });
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
      if (untukPimpinan) {
        try {
          await updateLicense(cleanKey, { hwids_pimpinan: [...hwidPimpinan, hwid] });
          license.hwids_pimpinan = [...hwidPimpinan, hwid];
        } catch (err) {
          // Kolom hwids_pimpinan belum dibuat: batalkan pendaftaran perangkat ini
          console.error('[activate] tandai perangkat pimpinan gagal:', err.message);
          try { await updateLicense(cleanKey, { hwids: currentHwids, hwid: currentHwids[0] || null }); } catch (e) {}
          return res.status(500).json({ valid: false, message: 'Server belum siap untuk perangkat Pimpinan. Hubungi penjual.' });
        }
      }
      license.hwids = [...currentHwids, hwid];
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
      pimpinan:    daftarHwidPimpinan(license).includes(hwid),
      token:       tokenLisensi(license, cleanKey, hwid, paket),
    });

  } catch (err) {
    console.error('Activation error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

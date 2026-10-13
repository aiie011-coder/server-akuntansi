// File: api/login.js
// Endpoint: POST /api/login
// Verifikasi username + PIN pengguna

const { getLicenseByKey, query } = require('../lib/db');
const { cekPin, hashPin, daftarHwid, alasanDitolak, tokenPengguna } = require('../lib/tanda');

const BATAS_GAGAL = 5;                 // percobaan PIN salah berturut-turut
const LAMA_KUNCI  = 15 * 60 * 1000;    // akun dikunci 15 menit

function filterUser(licenseKey, username) {
  return `license_users?license_key=eq.${encodeURIComponent(licenseKey)}&username=eq.${encodeURIComponent(username)}`;
}

async function getUser(licenseKey, username) {
  const rows = await query('GET', filterUser(licenseKey, username) + '&limit=1');
  return rows?.[0] || null;
}

// Perubahan kecil pada baris pengguna; kolom baru (gagal_login, kunci_sampai)
// mungkin belum dibuat — kegagalan di sini tidak boleh menggagalkan login.
async function updateUser(licenseKey, username, perubahan) {
  try { await query('PATCH', filterUser(licenseKey, username), perubahan); }
  catch (e) { console.error('[login] update pengguna gagal:', e.message); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, username, pin, hwid, app } = req.body || {};

  if (!key || !username || !pin || typeof key !== 'string' || typeof username !== 'string' || typeof pin !== 'string')
    return res.status(400).json({ valid: false, message: 'key, username, dan pin wajib diisi.' });
  if (app !== 'zequi-v1')
    return res.status(400).json({ valid: false, message: 'App tidak dikenal.' });
  if (!/^\d{6}$/.test(pin))
    return res.status(400).json({ valid: false, message: 'PIN harus 6 digit angka.' });

  try {
    const cleanKey = key.trim().toUpperCase();
    const uname = username.trim().toLowerCase();

    // Validasi lisensi: aktif, belum kedaluwarsa, dan perangkat terdaftar
    const license = await getLicenseByKey(cleanKey);
    const alasan = alasanDitolak(license);
    if (alasan) return res.json({ valid: false, message: alasan });
    if (!hwid || !daftarHwid(license).includes(hwid))
      return res.json({ valid: false, message: 'Perangkat ini belum terdaftar untuk lisensi ini.' });

    const user = await getUser(cleanKey, uname);
    if (!user || !user.is_active)
      return res.json({ valid: false, message: 'Pengguna tidak ditemukan atau tidak aktif.' });

    // Akun sedang dikunci karena terlalu banyak PIN salah?
    if (user.kunci_sampai && new Date(user.kunci_sampai) > new Date()) {
      const jam = new Date(user.kunci_sampai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
      return res.json({ valid: false, terkunci: true, message: `Terlalu banyak PIN salah. Coba lagi setelah pukul ${jam} WIB.` });
    }

    const hasil = cekPin(pin, user.pin_hash);
    if (!hasil.cocok) {
      const gagal = (Number(user.gagal_login) || 0) + 1;
      if (gagal >= BATAS_GAGAL) {
        await updateUser(cleanKey, uname, { gagal_login: 0, kunci_sampai: new Date(Date.now() + LAMA_KUNCI).toISOString() });
        return res.json({ valid: false, terkunci: true, message: `PIN salah ${BATAS_GAGAL} kali. Akun dikunci 15 menit.` });
      }
      await updateUser(cleanKey, uname, { gagal_login: gagal });
      return res.json({ valid: false, message: `PIN salah. Sisa ${BATAS_GAGAL - gagal} percobaan.` });
    }

    // Berhasil: reset hitungan, ganti hash lama ke format baru
    const perubahan = {};
    if (Number(user.gagal_login) > 0 || user.kunci_sampai) { perubahan.gagal_login = 0; perubahan.kunci_sampai = null; }
    if (hasil.perluUpgrade) perubahan.pin_hash = hashPin(pin);
    if (Object.keys(perubahan).length) await updateUser(cleanKey, uname, perubahan);

    const dataUser = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role === 'admin' ? 'admin' : 'operator',
    };
    return res.json({
      valid: true,
      message: `Selamat datang, ${user.display_name || user.username}!`,
      user: dataUser,
      token: tokenPengguna(cleanKey, hwid, dataUser),
    });

  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ valid: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

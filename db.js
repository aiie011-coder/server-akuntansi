// ============================================================
// AkuntansiPro — Database Helper (Vercel KV)
// File: lib/db.js
//
// Menggunakan Vercel KV (Redis) — GRATIS hingga 256MB
// Setup: vercel.com → Storage → Create KV Database
// Lalu: vercel env pull → otomatis dapat KV_REST_API_URL & KV_REST_API_TOKEN
// ============================================================

import { kv } from '@vercel/kv';

const PREFIX = 'akpro:lic:';

/**
 * Ambil data lisensi berdasarkan key
 * @param {string} key - Kode lisensi (contoh: ABCDE-FGHIJ-KLMNO-PQRST)
 * @returns {object|null}
 */
export async function getLicense(key) {
  try {
    const data = await kv.get(`${PREFIX}${key}`);
    return data || null;
  } catch (err) {
    console.error('getLicense error:', err);
    return null;
  }
}

/**
 * Simpan/buat lisensi baru
 * @param {string} key
 * @param {object} licenseData
 */
export async function saveLicense(key, licenseData) {
  await kv.set(`${PREFIX}${key}`, {
    ...licenseData,
    key,
    created: licenseData.created || new Date().toISOString()
  });
}

/**
 * Aktivasi lisensi — simpan HWID dan ubah status
 * @param {string} key
 * @param {string} hwid
 */
export async function activateLicense(key, hwid) {
  const existing = await getLicense(key);
  if (!existing) throw new Error('License not found');

  const updated = {
    ...existing,
    hwid,
    status: existing.type === 'trial' ? 'trial' : 'aktif',
    activated_at: new Date().toISOString()
  };

  await kv.set(`${PREFIX}${key}`, updated);
  return updated;
}

/**
 * Update status lisensi (aktif/nonaktif)
 */
export async function updateLicenseStatus(key, status) {
  const existing = await getLicense(key);
  if (!existing) throw new Error('License not found');
  await kv.set(`${PREFIX}${key}`, { ...existing, status });
}

/**
 * Reset HWID lisensi (untuk pindah PC)
 */
export async function resetLicenseHWID(key) {
  const existing = await getLicense(key);
  if (!existing) throw new Error('License not found');
  await kv.set(`${PREFIX}${key}`, {
    ...existing,
    hwid: null,
    status: 'unused',
    activated_at: null
  });
}

/**
 * List semua lisensi (untuk admin panel)
 * Menggunakan scan pattern
 */
export async function listAllLicenses() {
  const keys = await kv.keys(`${PREFIX}*`);
  if (!keys.length) return [];

  const licenses = await Promise.all(keys.map(k => kv.get(k)));
  return licenses.filter(Boolean).sort((a, b) =>
    new Date(b.created) - new Date(a.created)
  );
}

/**
 * Hapus lisensi
 */
export async function deleteLicense(key) {
  await kv.del(`${PREFIX}${key}`);
}

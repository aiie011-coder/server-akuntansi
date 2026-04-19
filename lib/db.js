// ============================================================
// AkuntansiPro — Database Helper (Supabase)
// File: lib/db.js
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function query(method, path, body = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL atau SUPABASE_KEY belum diisi di environment variable Vercel');
  }

  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${res.status} — ${err}`);
  }

  const text = await res.text();
  if (!text || text.trim() === '') return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse response: ${text}`);
  }
}

async function getLicense(key) {
  const data = await query('GET', `licenses?key=eq.${encodeURIComponent(key)}&limit=1`);
  return data?.[0] || null;
}

async function saveLicense(licData) {
  const row = {
    key: licData.key,
    name: licData.name || '',
    type: licData.type || 'lifetime',
    status: 'unused',
    hwid: null,
    hwids: [],
    max_devices: licData.max_devices || 1,
    note: licData.note || '',
    expires: licData.expires || null,
    activated_at: null
  };
  const data = await query('POST', 'licenses', row);
  return data?.[0] || null;
}

async function activateLicense(key, hwid) {
  const existing = await getLicense(key);
  if (!existing) throw new Error('License not found');

  const status = existing.type === 'trial' ? 'trial' : 'aktif';
  const currentHwids = Array.isArray(existing.hwids) ? existing.hwids : [];
  const maxDevices = existing.max_devices || 1;

  if (currentHwids.includes(hwid)) {
    return existing;
  }

  if (currentHwids.length >= maxDevices) {
    throw new Error(`DEVICE_LIMIT:${maxDevices}`);
  }

  const updatedHwids = [...currentHwids, hwid];

  const data = await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, {
    hwid: updatedHwids[0],
    hwids: updatedHwids,
    status,
    activated_at: existing.activated_at || new Date().toISOString()
  });

  return data?.[0] || null;
}

async function updateLicenseStatus(key, status) {
  await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, { status });
}

async function resetLicenseHWID(key) {
  await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, {
    hwid: null,
    hwids: [],
    status: 'unused',
    activated_at: null
  });
}

async function listAllLicenses() {
  const data = await query('GET', 'licenses?order=created_at.desc&limit=500');
  return data || [];
}

async function deleteLicense(key) {
  await query('DELETE', `licenses?key=eq.${encodeURIComponent(key)}`);
}

async function getLicenseByKey(key) {
  const data = await query('GET', `licenses?key=eq.${encodeURIComponent(key)}&limit=1`);
  return data?.[0] || null;
}

async function updateLicense(key, updates) {
  const data = await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, updates);
  return data?.[0] || null;
}

async function updateLicenseLastSeen(key, { hwid, last_seen }) {
  await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, {
    last_seen,
    ...(hwid ? { hwid } : {}),
  });
}

async function getAllLicenses() {
  const data = await query('GET', 'licenses?order=updated_at.desc&limit=500');
  return data || [];
}

module.exports = {
  query,
  getLicense,
  saveLicense,
  activateLicense,
  updateLicenseStatus,
  resetLicenseHWID,
  listAllLicenses,
  deleteLicense,
  getLicenseByKey,
  updateLicense,
  updateLicenseLastSeen,
  getAllLicenses,
};

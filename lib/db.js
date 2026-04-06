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

export async function getLicense(key) {
  const data = await query('GET', `licenses?key=eq.${encodeURIComponent(key)}&limit=1`);
  return data?.[0] || null;
}

export async function saveLicense(licData) {
  const row = {
    key: licData.key,
    name: licData.name || '',
    type: licData.type || 'lifetime',
    status: 'unused',
    hwid: null,
    note: licData.note || '',
    expires: licData.expires || null,
    activated_at: null
  };
  const data = await query('POST', 'licenses', row);
  return data?.[0] || null;
}

export async function activateLicense(key, hwid) {
  const existing = await getLicense(key);
  if (!existing) throw new Error('License not found');
  const status = existing.type === 'trial' ? 'trial' : 'aktif';
  const data = await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, {
    hwid,
    status,
    activated_at: new Date().toISOString()
  });
  return data?.[0] || null;
}

export async function updateLicenseStatus(key, status) {
  await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, { status });
}

export async function resetLicenseHWID(key) {
  await query('PATCH', `licenses?key=eq.${encodeURIComponent(key)}`, {
    hwid: null,
    status: 'unused',
    activated_at: null
  });
}

export async function listAllLicenses() {
  const data = await query('GET', 'licenses?order=created_at.desc&limit=500');
  return data || [];
}

export async function deleteLicense(key) {
  await query('DELETE', `licenses?key=eq.${encodeURIComponent(key)}`);
}

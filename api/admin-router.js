// ============================================================
// File: api/admin-router.js
// ============================================================
const { getLicenseByKey, updateLicense, getAllLicenses, query,
        getLicense, saveLicense, updateLicenseStatus,
        resetLicenseHWID, listAllLicenses, deleteLicense } = require('../lib/db');

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const VALID_PLANS  = ['trial', 'starter', 'pro', 'enterprise'];

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
  if (type === '1year')  d.setFullYear(d.getFullYear() + 1);
  if (type === '6month') d.setMonth(d.getMonth() + 6);
  if (type === 'trial')  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function isAuthorized(req, body) {
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${ADMIN_SECRET}`) return true;
  const cookie = req.headers.cookie || '';
  const sessionMatch = cookie.match(/akpro_session=([^;]+)/);
  const expectedToken = Buffer.from(ADMIN_SECRET).toString('base64');
  if (sessionMatch && sessionMatch[1] === expectedToken) return true;
  const admin_key = body?.admin_key || req.query?.admin_key;
  if (admin_key && admin_key === ADMIN_SECRET) return true;
  return false;
}

// Normalisasi locked_modules — selalu simpan sebagai array JSON string ke Supabase
// karena kolom bertipe text. Saat dibaca, plan-config.js akan parse kembali.
function normalizeLockedModules(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) return t; // sudah JSON string
    // CSV → JSON string
    const arr = t.split(',').map(s => s.trim()).filter(Boolean);
    return JSON.stringify(arr);
  }
  return '[]';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body   = req.body || {};
  const action = req.query.action || body.action;

  if (!isAuthorized(req, body)) return res.status(401).json({ error: 'Unauthorized' });

  try {

    // ── FORMAT 1 — kompatibel admin-panel.js ──────────────────

    if (action === 'list') {
      const licenses = await listAllLicenses();
      return res.json({ success: true, licenses });
    }

    if (action === 'generate') {
      const { name, type = 'lifetime', note = '', count = 1, max_devices = 1 } = body.data || {};
      const generated = [];
      for (let i = 0; i < Math.min(count, 20); i++) {
        const newKey = generateKey();
        await saveLicense({
          key: newKey, name: name || 'Tidak diisi', type, note,
          expires: getExpiry(type),
          max_devices: Math.min(Math.max(parseInt(max_devices) || 1, 1), 20),
        });
        generated.push(newKey);
      }
      return res.json({ success: true, keys: generated });
    }

    if (action === 'updateStatus') {
      const key = body.key;
      if (!key) return res.status(400).json({ error: 'key required' });
      await updateLicenseStatus(key, body.data?.status);
      return res.json({ success: true });
    }

    if (action === 'resetHWID') {
      const key = body.key;
      if (!key) return res.status(400).json({ error: 'key required' });
      await resetLicenseHWID(key);
      return res.json({ success: true });
    }

    if (action === 'delete') {
      const key = body.key;
      if (!key) return res.status(400).json({ error: 'key required' });
      await deleteLicense(key);
      return res.json({ success: true });
    }

    // ── FORMAT 2 — direct admin call ──────────────────────────

    if (action === 'list-users') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const licenses = await getAllLicenses();
      const safe = licenses.map(l => ({
        key:            l.key.substring(0, 5) + '-***-***-' + l.key.slice(-5),
        full_key:       l.key,
        customer_name:  l.customer_name,
        customer_email: l.customer_email,
        plan:           l.plan || 'trial',
        expiry_date:    l.expiry_date,
        is_active:      l.is_active,
        activated_at:   l.activated_at,
        last_seen:      l.last_seen,
        hwid:           l.hwid,
        max_companies:  l.max_companies,
        max_devices:    l.max_devices,
        notes:          l.notes,
      }));
      return res.status(200).json({ licenses: safe, total: safe.length });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (action === 'create-license') {
      const { key, customer_name, customer_email, plan, expiry_date, notes, max_devices } = body;
      if (!key || !customer_name)
        return res.status(400).json({ error: 'key dan customer_name wajib diisi' });
      const row = {
        key, customer_name,
        customer_email: customer_email || null,
        plan:           plan || 'trial',
        expiry_date:    expiry_date || null,
        notes:          notes || null,
        max_devices:    max_devices || 1,
        is_active:      true,
        updated_at:     new Date().toISOString(),
      };
      await query('POST', 'licenses', row);
      return res.status(200).json({ success: true, key, message: `Lisensi ${key} berhasil dibuat` });
    }

    if (action === 'set-plan') {
      const license_key = body.license_key || body.key;
      const {
        plan, expiry_date, max_companies, max_devices,
        export_enabled, print_full, locked_modules, is_active,
        revoke_reason, notes, customer_name, customer_email,
        jurnal_penutup_enabled, aset_saldo_menurun, komparasi_enabled,
        lra_lsal_enabled, reset_hwid,
      } = body;

      if (!license_key)
        return res.status(400).json({ error: 'license_key wajib diisi' });
      if (plan && !VALID_PLANS.includes(plan))
        return res.status(400).json({ error: `Plan tidak valid. Pilihan: ${VALID_PLANS.join(', ')}` });

      const license = await getLicenseByKey(license_key);
      if (!license) return res.status(404).json({ error: 'Lisensi tidak ditemukan' });

      const updates = { updated_at: new Date().toISOString() };
      if (plan              !== undefined) updates.plan              = plan;
      if (expiry_date       !== undefined) updates.expiry_date       = expiry_date;
      if (max_companies     !== undefined) updates.max_companies     = max_companies;
      if (max_devices       !== undefined) updates.max_devices       = max_devices;
      if (export_enabled    !== undefined) updates.export_enabled    = export_enabled;
      if (print_full        !== undefined) updates.print_full        = print_full;
      if (is_active         !== undefined) updates.is_active         = is_active;
      if (revoke_reason     !== undefined) updates.revoke_reason     = revoke_reason;
      if (notes             !== undefined) updates.notes             = notes;
      if (customer_name     !== undefined) updates.customer_name     = customer_name;
      if (customer_email    !== undefined) updates.customer_email    = customer_email;
      if (jurnal_penutup_enabled !== undefined) updates.jurnal_penutup_enabled = jurnal_penutup_enabled;
      if (aset_saldo_menurun     !== undefined) updates.aset_saldo_menurun     = aset_saldo_menurun;
      if (komparasi_enabled      !== undefined) updates.komparasi_enabled      = komparasi_enabled;
      if (lra_lsal_enabled       !== undefined) updates.lra_lsal_enabled       = lra_lsal_enabled;

      // FIX: locked_modules disimpan sebagai JSON string karena kolom Supabase bertipe text
      if (locked_modules !== undefined) {
        updates.locked_modules = normalizeLockedModules(locked_modules);
      }

      // Reset HWID jika diminta
      if (reset_hwid) {
        updates.hwid  = null;
        updates.hwids = [];
      }

      await updateLicense(license_key, updates);
      return res.status(200).json({ success: true, message: `Lisensi ${license_key} berhasil diupdate`, updated: updates });
    }

    if (action === 'delete-license') {
      const { license_key } = body;
      if (!license_key) return res.status(400).json({ error: 'license_key wajib diisi' });
      const license = await getLicenseByKey(license_key);
      if (!license) return res.status(404).json({ error: 'Lisensi tidak ditemukan' });
      await deleteLicense(license_key);
      return res.status(200).json({ success: true, message: `Lisensi ${license_key} berhasil dihapus` });
    }

    if (action === 'upload-logo') {
      const { image_base64, file_name, mime_type } = body;
      if (!image_base64 || !file_name)
        return res.status(400).json({ error: 'image_base64 dan file_name wajib diisi' });
      const base64Data     = image_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer         = Buffer.from(base64Data, 'base64');
      const contentType    = mime_type || 'image/png';
      const uploadFileName = `logo/zequi-logo.${contentType.split('/')[1] || 'png'}`;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/assets/${uploadFileName}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': contentType, 'x-upsert': 'true',
        },
        body: buffer,
      });
      if (!uploadRes.ok) { const err = await uploadRes.text(); throw new Error(`Upload gagal: ${err}`); }
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/assets/${uploadFileName}`;
      await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ key: 'logo_url', value: publicUrl, updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ success: true, logo_url: publicUrl, message: 'Logo berhasil diupload' });
    }

    return res.status(400).json({ error: `Action tidak dikenali: ${action}` });

  } catch (err) {
    console.error('[admin-router] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

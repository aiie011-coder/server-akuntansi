// ============================================================
// File: api/admin-router.js
// Menggabungkan semua endpoint admin jadi 1 serverless function
//
// Routing berdasarkan query ?action=...
//   GET  /api/admin-router?action=list-users&admin_key=xxx
//   POST /api/admin-router?action=create-license
//   POST /api/admin-router?action=set-plan
//   POST /api/admin-router?action=delete-license
//   POST /api/admin-router?action=upload-logo
// ============================================================

const { getLicenseByKey, updateLicense, getAllLicenses, query } = require('../lib/db');

const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const VALID_PLANS = ['trial', 'starter', 'pro', 'enterprise'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action;

  // ─── LIST USERS ─────────────────────────────────────────────
  if (action === 'list-users') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const admin_key = req.query.admin_key;
    if (!admin_key || admin_key !== ADMIN_SECRET)
      return res.status(401).json({ error: 'Unauthorized' });

    try {
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
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ─── Semua action POST berikut ───────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { admin_key } = body;

  if (!admin_key || admin_key !== ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });

  // ─── CREATE LICENSE ──────────────────────────────────────────
  if (action === 'create-license') {
    const { key, customer_name, customer_email, plan, expiry_date, notes, max_devices } = body;

    if (!key || !customer_name)
      return res.status(400).json({ error: 'key dan customer_name wajib diisi' });

    try {
      const row = {
        key,
        customer_name,
        customer_email:  customer_email || null,
        plan:            plan || 'trial',
        expiry_date:     expiry_date || null,
        notes:           notes || null,
        max_devices:     max_devices || 1,
        is_active:       true,
        updated_at:      new Date().toISOString(),
      };
      await query('POST', 'licenses', row);
      return res.status(200).json({ success: true, key, message: `Lisensi ${key} berhasil dibuat` });
    } catch (err) {
      console.error('[create-license] Error:', err);
      return res.status(500).json({ error: 'Server error', message: err.message });
    }
  }

  // ─── SET PLAN ────────────────────────────────────────────────
  if (action === 'set-plan') {
    const {
      license_key, plan, expiry_date, max_companies, max_devices,
      export_enabled, print_full, locked_modules, is_active,
      revoke_reason, notes, customer_name, customer_email,
      jurnal_penutup_enabled, aset_saldo_menurun, komparasi_enabled,
      lra_lsal_enabled, reset_hwid,
    } = body;

    if (!license_key)
      return res.status(400).json({ error: 'license_key wajib diisi' });
    if (plan && !VALID_PLANS.includes(plan))
      return res.status(400).json({ error: `Plan tidak valid. Pilihan: ${VALID_PLANS.join(', ')}` });

    try {
      const license = await getLicenseByKey(license_key);
      if (!license) return res.status(404).json({ error: 'Lisensi tidak ditemukan' });

      const updates = { updated_at: new Date().toISOString() };
      if (plan                    !== undefined) updates.plan                    = plan;
      if (expiry_date             !== undefined) updates.expiry_date             = expiry_date;
      if (max_companies           !== undefined) updates.max_companies           = max_companies;
      if (max_devices             !== undefined) updates.max_devices             = max_devices;
      if (export_enabled          !== undefined) updates.export_enabled          = export_enabled;
      if (print_full              !== undefined) updates.print_full              = print_full;
      if (locked_modules          !== undefined) updates.locked_modules          = locked_modules;
      if (is_active               !== undefined) updates.is_active               = is_active;
      if (revoke_reason           !== undefined) updates.revoke_reason           = revoke_reason;
      if (notes                   !== undefined) updates.notes                   = notes;
      if (customer_name           !== undefined) updates.customer_name           = customer_name;
      if (customer_email          !== undefined) updates.customer_email          = customer_email;
      if (jurnal_penutup_enabled  !== undefined) updates.jurnal_penutup_enabled  = jurnal_penutup_enabled;
      if (aset_saldo_menurun      !== undefined) updates.aset_saldo_menurun      = aset_saldo_menurun;
      if (komparasi_enabled       !== undefined) updates.komparasi_enabled       = komparasi_enabled;
      if (lra_lsal_enabled        !== undefined) updates.lra_lsal_enabled        = lra_lsal_enabled;
      if (reset_hwid)                            updates.hwid                    = null;

      await updateLicense(license_key, updates);
      return res.status(200).json({ success: true, message: `Lisensi ${license_key} berhasil diupdate`, updated: updates });
    } catch (err) {
      console.error('[set-plan] Error:', err);
      return res.status(500).json({ error: 'Server error', message: err.message });
    }
  }

  // ─── DELETE LICENSE ──────────────────────────────────────────
  if (action === 'delete-license') {
    const { license_key } = body;

    if (!license_key)
      return res.status(400).json({ error: 'license_key wajib diisi' });

    try {
      const license = await getLicenseByKey(license_key);
      if (!license) return res.status(404).json({ error: 'Lisensi tidak ditemukan' });

      await query('DELETE', 'licenses', { key: license_key });
      return res.status(200).json({ success: true, message: `Lisensi ${license_key} berhasil dihapus` });
    } catch (err) {
      console.error('[delete-license] Error:', err);
      return res.status(500).json({ error: 'Server error', message: err.message });
    }
  }

  // ─── UPLOAD LOGO ─────────────────────────────────────────────
  if (action === 'upload-logo') {
    const { image_base64, file_name, mime_type } = body;

    if (!image_base64 || !file_name)
      return res.status(400).json({ error: 'image_base64 dan file_name wajib diisi' });

    try {
      const base64Data   = image_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer       = Buffer.from(base64Data, 'base64');
      const contentType  = mime_type || 'image/png';
      const uploadFileName = `logo/zequi-logo.${contentType.split('/')[1] || 'png'}`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/assets/${uploadFileName}`,
        {
          method: 'POST',
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  contentType,
            'x-upsert':      'true',
          },
          body: buffer,
        }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Upload gagal: ${err}`);
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/assets/${uploadFileName}`;

      await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
        method: 'POST',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          key:        'logo_url',
          value:      publicUrl,
          updated_at: new Date().toISOString(),
        }),
      });

      return res.status(200).json({ success: true, logo_url: publicUrl, message: 'Logo berhasil diupload' });
    } catch (err) {
      console.error('[upload-logo] Error:', err);
      return res.status(500).json({ error: 'Server error', message: err.message });
    }
  }

  // ─── Action tidak dikenali ───────────────────────────────────
  return res.status(400).json({ error: `Action tidak dikenali: ${action}` });
};

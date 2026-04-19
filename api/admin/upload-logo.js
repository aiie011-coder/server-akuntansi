// File: api/admin/upload-logo.js
// Endpoint: POST /api/admin/upload-logo
// Upload logo ke Supabase Storage dan simpan URL ke tabel settings

const ADMIN_SECRET  = process.env.ADMIN_SECRET_KEY;
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { admin_key, image_base64, file_name, mime_type } = req.body || {};

  // Auth
  if (!admin_key || admin_key !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!image_base64 || !file_name) {
    return res.status(400).json({ error: 'image_base64 dan file_name wajib diisi' });
  }

  try {
    // Konversi base64 ke binary
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const contentType = mime_type || 'image/png';
    const uploadFileName = `logo/zequi-logo.${contentType.split('/')[1] || 'png'}`;

    // Upload ke Supabase Storage
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/assets/${uploadFileName}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true', // overwrite jika sudah ada
        },
        body: buffer,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Upload gagal: ${err}`);
    }

    // Buat public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/assets/${uploadFileName}`;

    // Simpan URL ke tabel settings
    await fetch(`${SUPABASE_URL}/rest/v1/settings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        key: 'logo_url',
        value: publicUrl,
        updated_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({
      success: true,
      logo_url: publicUrl,
      message: 'Logo berhasil diupload',
    });

  } catch (err) {
    console.error('[upload-logo] Error:', err);
    return res.status(500).json({ error: 'Server error', message: err.message });
  }
};

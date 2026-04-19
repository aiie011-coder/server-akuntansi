// File: api/settings.js
// Endpoint: GET /api/settings
// Ambil pengaturan publik seperti logo_url — dipanggil ZeQui saat startup

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/settings?select=key,value`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const rows = await r.json();
    const settings = {};
    (rows || []).forEach(row => { settings[row.key] = row.value; });

    return res.status(200).json({
      logo_url: settings.logo_url || null,
      app_name: settings.app_name || 'ZeQui',
    });

  } catch (err) {
    console.error('[settings] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

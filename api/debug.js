// File: api/debug.js
// HAPUS FILE INI setelah selesai debug!

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const secret = process.env.ADMIN_SECRET || '';

  return res.json({
    has_admin_secret: secret.length > 0,
    secret_length: secret.length,
    secret_preview: secret.length > 0 ? secret[0] + '***' + secret[secret.length - 1] : 'KOSONG',
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_KEY,
    node_env: process.env.NODE_ENV || 'unknown'
  });
}

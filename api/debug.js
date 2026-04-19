// File: api/debug.js
// HAPUS FILE INI setelah selesai debug!

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = process.env.ADMIN_SECRET || '';
  const authHeader = req.headers['authorization'] || '';
  const incoming = authHeader.replace('Bearer ', '');

  return res.json({
    has_admin_secret: secret.length > 0,
    secret_length: secret.length,
    secret_first_char: secret[0] || '',
    secret_last_char: secret[secret.length - 1] || '',
    incoming_auth_length: incoming.length,
    incoming_first_char: incoming[0] || '',
    incoming_last_char: incoming[incoming.length - 1] || '',
    match: secret === incoming,
    method: req.method
  });
};

const { getAllLicenses } = require('../../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { admin_key } = req.query;
  if (!admin_key || admin_key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const licenses = await getAllLicenses();
    const safe = licenses.map(l => ({
      key: l.key.substring(0,5) + '-***-***-' + l.key.slice(-5),
      full_key: l.key,
      customer_name: l.customer_name,
      customer_email: l.customer_email,
      plan: l.plan || 'trial',
      expiry_date: l.expiry_date,
      is_active: l.is_active,
      activated_at: l.activated_at,
      last_seen: l.last_seen,
      hwid: l.hwid,
      max_companies: l.max_companies,
      notes: l.notes,
    }));
    return res.status(200).json({ licenses: safe, total: safe.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

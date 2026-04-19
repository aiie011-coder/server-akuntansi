// File: api/health.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    status: 'ok',
    message: 'Server ZeQui berjalan normal',
    timestamp: new Date().toISOString()
  });
};

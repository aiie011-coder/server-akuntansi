// File: api/admin-panel.js
// Akses via: https://nama-project.vercel.app/api/admin-panel
// Ini melayani halaman HTML admin panel langsung dari server

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');

  const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

  // Cek session cookie
  const cookie = req.headers.cookie || '';
  const sessionMatch = cookie.match(/akpro_session=([^;]+)/);
  const isLoggedIn = sessionMatch && sessionMatch[1] === Buffer.from(ADMIN_SECRET).toString('base64');

  if (!isLoggedIn) {
    // Tampilkan halaman login
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = new URLSearchParams(Buffer.concat(chunks).toString());
      const pass = body.get('password') || '';
      if (pass === ADMIN_SECRET) {
        const token = Buffer.from(ADMIN_SECRET).toString('base64');
        res.setHeader('Set-Cookie', `akpro_session=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
        res.setHeader('Location', '/api/admin-panel');
        return res.status(302).end();
      } else {
        return res.status(200).send(loginPage('❌ Password salah!'));
      }
    }
    return res.status(200).send(loginPage(''));
  }

  // Sudah login — tampilkan admin panel
  return res.status(200).send(adminPage());
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AkuntansiPro Admin</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:linear-gradient(135deg,#0a1628,#0f2140);min-height:100vh;display:flex;align-items:center;justify-content:center;}
.box{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:48px 40px;width:100%;max-width:400px;backdrop-filter:blur(20px);text-align:center;}
.logo{font-size:52px;margin-bottom:8px;}
h1{color:#fff;font-size:22px;font-weight:800;margin-bottom:4px;}
p{color:rgba(148,163,184,.7);font-size:13px;margin-bottom:28px;}
input{width:100%;padding:13px 16px;margin-bottom:12px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;outline:none;}
input:focus{border-color:#3b82f6;}
button{width:100%;padding:13px;background:linear-gradient(135deg,#2563eb,#06b6d4);border:none;border-radius:10px;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;}
.err{color:#f87171;font-size:13px;margin-bottom:12px;font-weight:600;}
</style>
</head>
<body>
<div class="box">
  <div class="logo">📊</div>
  <h1>AkuntansiPro Admin</h1>
  <p>Masukkan password untuk mengakses panel</p>
  ${error ? `<div class="err">${error}</div>` : ''}
  <form method="POST">
    <input type="password" name="password" placeholder="Admin Secret" autofocus required>
    <button type="submit">🔓 Masuk</button>
  </form>
</div>
</body>
</html>`;
}

function adminPage() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AkuntansiPro — Admin Panel</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
:root{--primary:#1e3a5f;--pl:#2563eb;--ac:#06b6d4;--ac2:#10b981;--danger:#ef4444;--warn:#f59e0b;--bg:#f0f4f8;--card:#fff;--sidebar:#0f2140;--text:#1e293b;--text2:#64748b;--text3:#94a3b8;--border:#e2e8f0;--shadow:0 4px 20px rgba(0,0,0,.08);--r:12px;--r2:8px;--font:'Plus Jakarta Sans',sans-serif;--mono:'JetBrains Mono',monospace;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;}
.topbar{background:var(--sidebar);padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 12px rgba(0,0,0,.2);}
.t-title{color:#fff;font-weight:800;font-size:16px;}
.t-sub{color:rgba(148,163,184,.7);font-size:11px;}
.t-right{display:flex;align-items:center;gap:12px;}
.badge{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#34d399;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;}
.logout{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font);text-decoration:none;}
.container{max-width:1200px;margin:0 auto;padding:24px;}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;}
.stat{background:var(--card);border-radius:var(--r);padding:20px;border:1px solid var(--border);box-shadow:var(--shadow);position:relative;overflow:hidden;}
.stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.stat.blue::before{background:linear-gradient(90deg,#2563eb,#06b6d4);}
.stat.green::before{background:linear-gradient(90deg,#10b981,#06b6d4);}
.stat.red::before{background:linear-gradient(90deg,#ef4444,#f59e0b);}
.stat.purple::before{background:linear-gradient(90deg,#8b5cf6,#ec4899);}
.sl{font-size:11px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.sv{font-size:28px;font-weight:800;font-family:var(--mono);margin:6px 0 2px;}
.ss{font-size:11px;color:var(--text3);}
.card{background:var(--card);border-radius:var(--r);border:1px solid var(--border);box-shadow:var(--shadow);overflow:hidden;margin-bottom:20px;}
.ch{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.ct{font-weight:700;font-size:15px;}
.cb{padding:20px;}
.fg{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.fg label{font-size:12px;font-weight:700;color:var(--text2);}
.fg small{font-size:11px;color:var(--text3);margin-top:2px;}
.fc{padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--r2);font-family:var(--font);font-size:13px;color:var(--text);outline:none;transition:.2s;width:100%;}
.fc:focus{border-color:var(--pl);}
.form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px;}
.btn{padding:9px 18px;border-radius:var(--r2);border:none;font-family:var(--font);font-size:13px;font-weight:600;cursor:pointer;transition:.2s;display:inline-flex;align-items:center;gap:6px;}
.btn-p{background:var(--pl);color:#fff;}.btn-p:hover{background:#1d4ed8;}
.btn-s{background:var(--ac2);color:#fff;}
.btn-d{background:var(--danger);color:#fff;}
.btn-w{background:var(--warn);color:#fff;}
.btn-sm{padding:5px 10px;font-size:12px;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
table{width:100%;border-collapse:collapse;font-size:13px;}
thead th{background:var(--bg);padding:10px 14px;text-align:left;font-weight:700;font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--text2);border-bottom:2px solid var(--border);}
tbody td{padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:middle;}
tbody tr:last-child td{border-bottom:none;}
tbody tr:hover td{background:rgba(37,99,235,.03);}
.mono{font-family:var(--mono);font-size:12px;letter-spacing:1px;}
.bx{padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;}
.b-aktif{background:#d1fae5;color:#065f46;}
.b-nonaktif{background:#fee2e2;color:#991b1b;}
.b-unused{background:#e0f2fe;color:#0369a1;}
.b-trial{background:#fef3c7;color:#92400e;}
.b-single{background:#f1f5f9;color:#475569;}
.b-tim{background:#ede9fe;color:#5b21b6;}
.search-box{display:flex;align-items:center;gap:8px;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--r2);padding:7px 12px;min-width:220px;}
.search-box input{background:none;border:none;outline:none;font-family:var(--font);font-size:13px;color:var(--text);width:100%;}
#toast-c{position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;}
.tn{padding:12px 16px;border-radius:var(--r2);color:#fff;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:tIn .3s ease;min-width:260px;}
.tn.s{background:#10b981;}.tn.e{background:#ef4444;}.tn.i{background:#2563eb;}
@keyframes tIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.gen-result{display:none;margin-top:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;}
.table-wrap{overflow-x:auto;}

/* Highlight khusus baris lisensi tim */
tr.row-tim td { background: rgba(139,92,246,.03); }
tr.row-tim:hover td { background: rgba(139,92,246,.07) !important; }

/* Device badge */
.dev-badge {
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700;
}
.dev-single{background:#f1f5f9;color:#475569;}
.dev-tim{background:#ede9fe;color:#5b21b6;}
.dev-full{background:#fee2e2;color:#991b1b;}
</style>
</head>
<body>
<div class="topbar">
  <div style="display:flex;align-items:center;gap:12px;">
    <div style="font-size:24px;">📊</div>
    <div><div class="t-title">AkuntansiPro Admin</div><div class="t-sub">Panel Manajemen Lisensi</div></div>
  </div>
  <div class="t-right">
    <div class="badge">🛡️ Admin</div>
    <a href="/api/admin-panel?logout=1" class="logout">Keluar</a>
  </div>
</div>

<div class="container">
  <div class="stats-row">
    <div class="stat blue"><div class="sl">Total Lisensi</div><div class="sv" id="s-total">—</div><div class="ss">Semua</div></div>
    <div class="stat green"><div class="sl">Aktif</div><div class="sv" id="s-aktif">—</div><div class="ss">Digunakan</div></div>
    <div class="stat red"><div class="sl">Nonaktif</div><div class="sv" id="s-nonaktif">—</div><div class="ss">Diblokir</div></div>
    <div class="stat purple"><div class="sl">Belum Aktif</div><div class="sv" id="s-unused">—</div><div class="ss">Menunggu</div></div>
  </div>

  <!-- GENERATE -->
  <div class="card">
    <div class="ch"><div class="ct">✨ Generate Kode Lisensi Baru</div></div>
    <div class="cb">
      <div class="form-row">
        <div class="fg">
          <label>Nama Pembeli</label>
          <input class="fc" id="g-name" placeholder="cth: PT Maju Jaya">
        </div>
        <div class="fg">
          <label>Tipe</label>
          <select class="fc" id="g-type">
            <option value="lifetime">♾️ Seumur Hidup</option>
            <option value="1year">📅 1 Tahun</option>
            <option value="6month">📅 6 Bulan</option>
            <option value="trial">⏰ Trial 30 Hari</option>
          </select>
        </div>
        <div class="fg">
          <label>🖥️ Maks. Perangkat</label>
          <select class="fc" id="g-maxdev" onchange="onMaxDevChange()">
            <option value="1">1 Perangkat — Single User</option>
            <option value="3">3 Perangkat — Tim Kecil</option>
            <option value="5">5 Perangkat — Tim Standar</option>
            <option value="10">10 Perangkat — Tim Besar</option>
            <option value="custom">✏️ Kustom...</option>
          </select>
          <small>Lisensi Tim: 1 kode untuk beberapa perangkat</small>
        </div>
        <div class="fg" id="fg-custom" style="display:none;">
          <label>Jumlah Perangkat (Kustom)</label>
          <input class="fc" id="g-maxdev-custom" type="number" value="2" min="2" max="20" placeholder="2–20">
          <small>Maksimal 20 perangkat</small>
        </div>
        <div class="fg">
          <label>Jumlah Kode</label>
          <input class="fc" id="g-count" type="number" value="1" min="1" max="20">
          <small>Generate beberapa kode sekaligus</small>
        </div>
        <div class="fg">
          <label>Catatan</label>
          <input class="fc" id="g-note" placeholder="cth: via Tokopedia">
        </div>
      </div>

      <!-- Preview sebelum generate -->
      <div id="gen-preview" style="margin-bottom:12px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1e40af;display:flex;align-items:center;gap:8px;">
        <span>📋</span>
        <span id="gen-preview-text">Akan dibuat: <strong>1 kode</strong> lisensi <strong>Single (1 perangkat)</strong></span>
      </div>

      <button class="btn btn-p" onclick="generateLicense()" id="gen-btn">✨ Generate</button>

      <div class="gen-result" id="gen-result">
        <div style="font-weight:700;font-size:13px;color:#065f46;margin-bottom:8px;">✅ Kode berhasil dibuat — kirim ke pembeli:</div>
        <div id="gen-keys" style="font-family:var(--mono);font-size:15px;letter-spacing:2px;color:#047857;line-height:2.4;"></div>
        <div id="gen-info" style="margin-top:8px;font-size:12px;color:#065f46;"></div>
        <button class="btn btn-s btn-sm" style="margin-top:10px;" onclick="copyKeys()">📋 Salin Semua</button>
      </div>
    </div>
  </div>

  <!-- LIST -->
  <div class="card">
    <div class="ch">
      <div class="ct">📋 Daftar Lisensi</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <div class="search-box"><span>🔍</span><input type="text" placeholder="Cari..." id="search-q" oninput="filterTable()"></div>
        <select class="fc" id="filter-s" onchange="filterTable()" style="width:auto;">
          <option value="">Semua</option>
          <option value="unused">Belum Aktif</option>
          <option value="aktif">Aktif</option>
          <option value="trial">Trial</option>
          <option value="nonaktif">Nonaktif</option>
        </select>
        <select class="fc" id="filter-tier" onchange="filterTable()" style="width:auto;">
          <option value="">Semua Tier</option>
          <option value="single">Single (1 perangkat)</option>
          <option value="tim">Tim (2+ perangkat)</option>
        </select>
        <button class="btn btn-s btn-sm" onclick="loadLicenses()">🔄 Refresh</button>
        <button class="btn btn-sm" style="background:var(--bg);border:1.5px solid var(--border);" onclick="exportCSV()">📥 CSV</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Kode Lisensi</th>
            <th>Nama</th>
            <th>Tipe</th>
            <th>Perangkat</th>
            <th>Status</th>
            <th>Aktivasi</th>
            <th>Berlaku S/d</th>
            <th>Catatan</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody id="lic-tbody">
          <tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text3);">⏳ Memuat...</td></tr>
        </tbody>
      </table>
    </div>
    <div style="padding:10px 20px;font-size:12px;color:var(--text3);border-top:1px solid var(--border);" id="tbl-info"></div>
  </div>
</div>

<div id="toast-c"></div>

<script>
let allLics = [];
let lastKeys = [];
let lastMaxDevices = 1;

// Update preview text saat form berubah
function updatePreview() {
  const count = Math.min(20, Math.max(1, parseInt(document.getElementById('g-count').value) || 1));
  const maxDev = getMaxDevices();
  const isTim = maxDev > 1;
  const tierLabel = isTim ? \`Tim (\${maxDev} perangkat)\` : 'Single (1 perangkat)';
  document.getElementById('gen-preview-text').innerHTML =
    \`Akan dibuat: <strong>\${count} kode</strong> lisensi <strong>\${tierLabel}</strong>\${isTim ? ' 🟣' : ''}\`;
}

function onMaxDevChange() {
  const val = document.getElementById('g-maxdev').value;
  document.getElementById('fg-custom').style.display = val === 'custom' ? 'flex' : 'none';
  updatePreview();
}

function getMaxDevices() {
  const sel = document.getElementById('g-maxdev').value;
  if (sel === 'custom') {
    return Math.min(20, Math.max(2, parseInt(document.getElementById('g-maxdev-custom').value) || 2));
  }
  return parseInt(sel) || 1;
}

// Pasang event listener agar preview auto-update
document.addEventListener('DOMContentLoaded', () => {
  ['g-count','g-maxdev-custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });
  updatePreview();
});

async function apiCall(action, data={}, key=null) {
  const r = await fetch('/api/admin-router', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({action, data, key})
  });
  if (!r.ok) throw new Error('Server error ' + r.status);
  return r.json();
}

async function loadLicenses() {
  try {
    const res = await apiCall('list');
    allLics = res.licenses || [];
    renderStats();
    filterTable();
  } catch(e) {
    document.getElementById('lic-tbody').innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--danger);">❌ Gagal memuat: ' + e.message + '</td></tr>';
  }
}

function renderStats() {
  document.getElementById('s-total').textContent = allLics.length;
  document.getElementById('s-aktif').textContent = allLics.filter(l=>l.status==='aktif'||l.status==='trial').length;
  document.getElementById('s-nonaktif').textContent = allLics.filter(l=>l.status==='nonaktif').length;
  document.getElementById('s-unused').textContent = allLics.filter(l=>l.status==='unused').length;
}

function filterTable() {
  const q = (document.getElementById('search-q').value||'').toLowerCase();
  const fs = document.getElementById('filter-s').value;
  const ft = document.getElementById('filter-tier').value;
  const filtered = allLics.filter(l => {
    const mq = !q || (l.key||'').toLowerCase().includes(q)||(l.name||'').toLowerCase().includes(q)||(l.note||'').toLowerCase().includes(q);
    const ms = !fs || l.status===fs;
    const maxDev = l.max_devices || 1;
    const mt = !ft || (ft==='single' && maxDev===1) || (ft==='tim' && maxDev>1);
    return mq && ms && mt;
  });

  document.getElementById('lic-tbody').innerHTML = filtered.map((l,i) => {
    const maxDev = l.max_devices || 1;
    const isTim = maxDev > 1;
    // Hitung perangkat yang sudah terdaftar
    const usedDevices = Array.isArray(l.hwids) ? l.hwids.length : (l.hwid ? 1 : 0);
    const isFull = usedDevices >= maxDev;
    const devBadgeClass = isTim ? (isFull ? 'dev-full' : 'dev-tim') : 'dev-single';
    const devLabel = isTim
      ? \`🟣 \${usedDevices}/\${maxDev} perangkat\`
      : (l.hwid ? '🖥️ 1/1' : '⬜ 0/1');

    return \`<tr class="\${isTim ? 'row-tim' : ''}">
      <td style="color:var(--text3);font-size:11px;">\${i+1}</td>
      <td>
        <span class="mono" style="font-weight:700;">\${l.key}</span>
        <button onclick="copyKey('\${l.key}')" style="background:none;border:none;cursor:pointer;" title="Salin">📋</button>
      </td>
      <td style="font-weight:600;">\${esc(l.name||'—')}</td>
      <td style="font-size:12px;">\${typeBadge(l.type)}</td>
      <td><span class="dev-badge \${devBadgeClass}">\${devLabel}</span></td>
      <td>\${statusBadge(l.status)}</td>
      <td style="font-size:12px;color:var(--text2);">\${l.activated_at ? new Date(l.activated_at).toLocaleDateString('id-ID') : '—'}</td>
      <td style="font-size:12px;\${!l.expires?'color:#10b981;font-weight:700;':''}">\${l.expires ? new Date(l.expires).toLocaleDateString('id-ID') : '♾️ Seumur Hidup'}</td>
      <td style="font-size:12px;color:var(--text3);">\${esc(l.note||'—')}</td>
      <td><div style="display:flex;gap:4px;flex-wrap:wrap;">
        \${l.status==='aktif'||l.status==='trial' ? \`<button class="btn btn-d btn-sm" onclick="setStatus('\${l.key}','nonaktif')" title="Nonaktifkan">🚫</button>\` : ''}
        \${l.status==='nonaktif' ? \`<button class="btn btn-s btn-sm" onclick="setStatus('\${l.key}','aktif')" title="Aktifkan">✅</button>\` : ''}
        \${(l.hwid || (Array.isArray(l.hwids) && l.hwids.length > 0)) ? \`<button class="btn btn-sm" style="background:var(--bg);border:1.5px solid var(--border);" onclick="doReset('\${l.key}')" title="Reset semua perangkat">🔄</button>\` : ''}
        <button class="btn btn-d btn-sm" onclick="doDelete('\${l.key}')" title="Hapus">🗑️</button>
      </div></td>
    </tr>\`;
  }).join('') || '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3);">Tidak ada data</td></tr>';

  document.getElementById('tbl-info').textContent = filtered.length + ' dari ' + allLics.length + ' lisensi';
}

function typeBadge(t){
  const m={lifetime:'♾️ Seumur Hidup','1year':'📅 1 Tahun','6month':'📅 6 Bulan',trial:'⏰ Trial'};
  return '<span style="font-size:12px;">'+(m[t]||t)+'</span>';
}
function statusBadge(s){
  const m={
    unused:'<span class="bx b-unused">⬜ Belum Aktif</span>',
    aktif:'<span class="bx b-aktif">✅ Aktif</span>',
    trial:'<span class="bx b-trial">⏰ Trial</span>',
    nonaktif:'<span class="bx b-nonaktif">🚫 Nonaktif</span>'
  };
  return m[s]||s;
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

async function generateLicense() {
  const name = document.getElementById('g-name').value.trim() || 'Tidak diisi';
  const type = document.getElementById('g-type').value;
  const count = Math.min(20, Math.max(1, parseInt(document.getElementById('g-count').value) || 1));
  const note = document.getElementById('g-note').value.trim();
  const max_devices = getMaxDevices();
  const btn = document.getElementById('gen-btn');

  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    const res = await apiCall('generate', { name, type, note, count, max_devices });
    if (res.success) {
      lastKeys = res.keys;
      lastMaxDevices = max_devices;
      const isTim = max_devices > 1;

      document.getElementById('gen-result').style.display = 'block';
      document.getElementById('gen-keys').innerHTML = res.keys.map(k =>
        \`<div>🔑 <strong>\${k}</strong>\${isTim ? \` <span style="font-size:11px;color:#5b21b6;background:#ede9fe;padding:2px 8px;border-radius:20px;margin-left:8px;">Tim \${max_devices} perangkat</span>\` : ''}</div>\`
      ).join('');
      document.getElementById('gen-info').innerHTML = isTim
        ? \`ℹ️ Kode ini dapat diaktifkan di <strong>\${max_devices} perangkat berbeda</strong> secara bersamaan.\`
        : \`ℹ️ Kode ini hanya dapat diaktifkan di <strong>1 perangkat</strong>.\`;

      toast('✅ ' + res.keys.length + ' kode dibuat!', 's');
      loadLicenses();
    }
  } catch(e) {
    toast('❌ ' + e.message, 'e');
  }

  btn.disabled = false;
  btn.textContent = '✨ Generate';
}

function copyKeys() {
  navigator.clipboard.writeText(lastKeys.join('\\n')).then(() => toast('📋 Disalin!', 'i'));
}
function copyKey(k) {
  navigator.clipboard.writeText(k).then(() => toast('📋 Kode disalin!', 'i'));
}

async function setStatus(key, status) {
  try {
    await apiCall('updateStatus', {status}, key);
    toast('Status diubah → ' + status, status === 'aktif' ? 's' : 'e');
    loadLicenses();
  } catch(e) { toast('❌ ' + e.message, 'e'); }
}

async function doReset(key) {
  if (!confirm('Reset semua perangkat terdaftar untuk lisensi ' + key + '?\\nPengguna harus aktivasi ulang di perangkat baru.')) return;
  try {
    await apiCall('resetHWID', {}, key);
    toast('🔄 Semua perangkat direset', 's');
    loadLicenses();
  } catch(e) { toast('❌ ' + e.message, 'e'); }
}

async function doDelete(key) {
  if (!confirm('Hapus lisensi ' + key + '? Tidak bisa dibatalkan!')) return;
  try {
    await apiCall('delete', {}, key);
    toast('🗑️ Dihapus', 'e');
    loadLicenses();
  } catch(e) { toast('❌ ' + e.message, 'e'); }
}

function exportCSV() {
  if (!allLics.length) { toast('Tidak ada data', 'e'); return; }
  const h = ['Kode','Nama','Tipe','Maks Perangkat','Perangkat Terdaftar','Status','Aktivasi','Berlaku','Catatan'];
  const rows = allLics.map(l => {
    const usedDevices = Array.isArray(l.hwids) ? l.hwids.length : (l.hwid ? 1 : 0);
    return [
      l.key, l.name||'', l.type,
      l.max_devices||1, usedDevices,
      l.status,
      l.activated_at ? new Date(l.activated_at).toLocaleDateString('id-ID') : '',
      l.expires ? new Date(l.expires).toLocaleDateString('id-ID') : 'Seumur Hidup',
      l.note||''
    ].map(v => '"'+v+'"').join(',');
  });
  const csv = [h.join(','), ...rows].join('\\n');
  const blob = new Blob(['\\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'akpro-licenses.csv'; a.click();
  toast('📥 CSV diunduh', 's');
}

function toast(msg, type='i', dur=3500) {
  const c = document.getElementById('toast-c');
  const t = document.createElement('div');
  t.className = 'tn ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), dur);
}

// Init
loadLicenses();
updatePreview();
</script>
</body>
</html>`;
}

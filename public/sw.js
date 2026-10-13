// ZeQui — service worker: aplikasi tetap terbuka tanpa internet.
// Halaman utama: tampilkan salinan tersimpan dulu (cepat & offline),
// lalu ambil versi terbaru di belakang layar; bila berbeda, minta muat ulang.
const CACHE = 'zequi-v1';
const FILE_INTI = ['/', '/manifest.json', '/ikon-180.png', '/ikon-192.png', '/ikon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILE_INTI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Penanda "ada versi baru yang belum dipakai halaman" (bertahan walau SW dimatikan browser)
const PENANDA = '/__zq_versi_baru';
async function kabariVersiBaru() {
  const cs = await self.clients.matchAll({ type: 'window' });
  cs.forEach(c => c.postMessage({ type: 'versi-baru' }));
}

async function halamanUtama(req) {
  const c = await caches.open(CACHE);
  const tersimpan = await c.match('/');
  const teksLama = tersimpan ? await tersimpan.clone().text() : null;
  // Halaman ini akan memakai salinan terbaru, jadi penanda lama tidak berlaku
  await c.delete(PENANDA);
  const ambil = (async () => {
    try {
      const r = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('text/html')) return r;
      const teksBaru = await r.clone().text();
      await c.put('/', new Response(teksBaru, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      if (teksLama !== null && teksLama !== teksBaru) {
        await c.put(PENANDA, new Response('1'));
        await kabariVersiBaru();
      }
      return r;
    } catch (err) { console.warn('[sw] gagal ambil versi terbaru:', err && err.message); return null; }
  })();
  if (tersimpan) return { res: tersimpan, latar: ambil };
  const r = await ambil;
  return { res: r || new Response('<h3 style="font-family:sans-serif">ZeQui belum tersimpan di perangkat ini. Sambungkan internet lalu buka lagi.</h3>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }) };
}

// Halaman bertanya setelah selesai dimuat (pesan langsung bisa terlewat saat halaman baru dibuka)
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'cek-versi') return;
  e.waitUntil(caches.open(CACHE).then(c => c.match(PENANDA)).then(m => { if (m && e.source) e.source.postMessage({ type: 'versi-baru' }); }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Server lisensi & alamat lain tidak disentuh
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    const kerja = halamanUtama(req);
    e.respondWith(kerja.then(h => h.res));
    e.waitUntil(kerja.then(h => h.latar));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});

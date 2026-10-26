// Pembersih service worker lama.
// Dulu aplikasi ZeQui berada di alamat utama dan menyimpan salinannya di sini.
// Sekarang alamat utama adalah landing page dan aplikasi pindah ke /app/,
// jadi service worker lama ini menghapus salinan lama lalu melepaskan diri.
// Data pembukuan di browser tidak tersentuh (data ada di IndexedDB/localStorage, bukan di cache ini).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => !k.startsWith('zequi-app-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach(c => { try { c.navigate(c.url); } catch (err) {} });
  })());
});

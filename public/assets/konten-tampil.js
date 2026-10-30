/* Menampilkan berita dan ulasan dari konten/konten.js (dibuat oleh Editor Konten ZeQui). */
(function () {
  var K = window.ZEQUI_KONTEN || {};
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function tgl(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? (+m[3]) + ' ' + BULAN[+m[2] - 1] + ' ' + m[1] : '';
  }
  function aman(p) {
    // hanya foto di folder konten/ yang dipakai
    return /^konten\/[\w\/.-]+$/.test(p || '') ? p : '';
  }
  // Baris kosong memisahkan paragraf; baris yang diawali "- " menjadi daftar
  function isiHtml(t) {
    return String(t || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (blok) {
      var out = '', teks = [], daftar = [];
      var tutup = function () {
        if (teks.length) out += '<p>' + teks.map(esc).join('<br>') + '</p>';
        if (daftar.length) out += '<ul>' + daftar.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
        teks = []; daftar = [];
      };
      blok.split('\n').forEach(function (b) {
        if (!b.trim()) return;
        var m = /^\s*[-•]\s+(.*)$/.exec(b);
        if (m) { if (teks.length) tutup(); daftar.push(m[1]); }
        else { if (daftar.length) tutup(); teks.push(b); }
      });
      tutup();
      return out;
    }).join('');
  }

  var BERITA = (K.berita || []).filter(function (b) { return b && b.tampil !== false && b.judul && b.id; })
    .sort(function (a, b) { return String(b.tanggal || '').localeCompare(String(a.tanggal || '')); });
  var ULASAN = (K.ulasan || []).filter(function (u) { return u && u.tampil !== false && u.izin && u.nama && u.isi; })
    .sort(function (a, b) { return String(b.tanggal || '').localeCompare(String(a.tanggal || '')); });
  var FORM = /^https:\/\//.test(K.tautanUlasan || '') ? K.tautanUlasan : '';

  function kartuBerita(b) {
    var f = aman(b.foto);
    return '<a class="kartu-berita" href="berita.html?id=' + encodeURIComponent(b.id) + '">' +
      (f ? '<span class="kb-foto"><img src="' + esc(f) + '" alt="' + esc(b.ketFoto || b.judul) + '" loading="lazy"></span>' : '<span class="kb-foto kb-kosong"></span>') +
      '<span class="kb-isi"><span class="kb-meta">' + esc(b.kategori || 'Berita') + ' &middot; ' + esc(tgl(b.tanggal)) + '</span>' +
      '<b>' + esc(b.judul) + '</b>' + (b.ringkasan ? '<span class="kb-ring">' + esc(b.ringkasan) + '</span>' : '') +
      '<span class="kb-baca">Baca selengkapnya</span></span></a>';
  }

  function bintang(n) {
    n = Math.max(0, Math.min(5, +n || 0));
    if (!n) return '';
    var s = '';
    for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'isi' : '') + '">&#9733;</i>';
    return '<span class="bintang" aria-label="' + n + ' dari 5 bintang">' + s + '</span>';
  }
  function kartuUlasan(u) {
    var siapa = [u.jabatan, u.lembaga].filter(Boolean).map(esc).join(', ');
    return '<figure class="kartu-ulasan">' + bintang(u.bintang) + '<blockquote>' + esc(u.isi) + '</blockquote>' +
      '<figcaption><b>' + esc(u.nama) + '</b>' + (siapa ? '<span>' + siapa + '</span>' : '') + '</figcaption></figure>';
  }

  // Tautan menu "Berita" dan "Beri ulasan" hanya muncul bila ada isinya
  if (BERITA.length) document.querySelectorAll('.js-berita').forEach(function (a) { a.hidden = false; });
  if (FORM) document.querySelectorAll('.js-form-ulasan').forEach(function (a) { a.href = FORM; a.hidden = false; });

  // Landing page: 3 berita terbaru
  var bt = document.getElementById('berita');
  if (bt && BERITA.length) {
    bt.querySelector('.grid-berita').innerHTML = BERITA.slice(0, 3).map(kartuBerita).join('');
    var semua = bt.querySelector('.js-semua-berita');
    if (semua) semua.hidden = BERITA.length <= 3;
    bt.hidden = false;
  }

  // Landing page: ulasan, dipisah Pelatihan dan Aplikasi
  var ul = document.getElementById('ulasan');
  if (ul && ULASAN.length) {
    var grup = ['Pelatihan', 'Aplikasi'].map(function (j) { return { j: j, d: ULASAN.filter(function (u) { return u.layanan === j; }) }; })
      .filter(function (g) { return g.d.length; });
    var tab = ul.querySelector('.ulasan-tab'), isi = ul.querySelector('.grid-ulasan');
    var tampil = function (i) {
      isi.innerHTML = grup[i].d.slice(0, 6).map(kartuUlasan).join('');
      tab.querySelectorAll('button').forEach(function (b, k) { b.classList.toggle('aktif', k === i); });
    };
    tab.innerHTML = grup.length > 1 ? grup.map(function (g, i) { return '<button type="button" data-i="' + i + '">' + g.j + '</button>'; }).join('') : '';
    tab.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { tampil(+b.getAttribute('data-i')); }); });
    tampil(0);
    ul.hidden = false;
  }

  // Produk digital dari konten/produk.js; pembelian di halaman toko (Lynk)
  var P = window.ZEQUI_PRODUK || {};
  var PRODUK = (P.produk || []).filter(function (p) { return p && p.tampil !== false && p.nama && /^https:\/\//.test(p.tautan || ''); });
  function rp(n) { return 'Rp ' + String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function kartuProduk(p) {
    var g = aman(p.gambar), gratis = !(+p.harga);
    return '<article class="kartu-produk">' +
      (g ? '<a class="kp-foto" href="' + esc(p.tautan) + '" target="_blank" rel="noopener" tabindex="-1"><img src="' + esc(g) + '" alt="' + esc(p.nama) + '" loading="lazy" width="720" height="720"></a>' : '') +
      // Sampul sudah memuat label, subjudul, dan isi; teksnya hanya ditulis bila produk tanpa gambar
      '<div class="kp-isi">' + (!g && p.label ? '<span class="kp-label">' + esc(p.label) + '</span>' : '') +
      '<h3>' + esc(p.nama) + '</h3>' + (!g && p.subjudul ? '<p class="kp-sub">' + esc(p.subjudul) + '</p>' : '') +
      (!g && (p.poin || []).length ? '<ul class="cek">' + p.poin.slice(0, 4).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="kp-bawah"><div class="kp-harga">' + (+p.hargaCoret > +p.harga ? '<s>' + rp(p.hargaCoret) + '</s>' : '') + '<strong>' + (gratis ? 'Gratis' : rp(p.harga)) + '</strong></div>' +
      '<a class="btn btn-garis" href="' + esc(p.tautan) + '" target="_blank" rel="noopener">' + (gratis ? 'Ambil gratis' : 'Beli') + '</a></div></div></article>';
  }
  if (PRODUK.length) document.querySelectorAll('.js-produk').forEach(function (a) { a.hidden = false; });

  // Landing page: produk unggulan (paling banyak 3)
  var pr = document.getElementById('produk');
  if (pr && PRODUK.length) {
    var ung = PRODUK.filter(function (p) { return p.unggulan; });
    if (!ung.length) ung = PRODUK;
    pr.querySelector('.grid-produk').innerHTML = ung.slice(0, 3).map(kartuProduk).join('');
    var lain = pr.querySelector('.js-semua-produk');
    if (lain) { lain.textContent = 'Lihat semua ' + PRODUK.length + ' produk'; lain.hidden = PRODUK.length <= 3; }
    pr.hidden = false;
  }

  // Halaman produk.html: semua produk, dikelompokkan
  var hp = document.getElementById('produk-hal');
  if (hp) {
    var kel = [];
    PRODUK.forEach(function (p) { var k = p.kelompok || 'Lainnya'; if (kel.indexOf(k) < 0) kel.push(k); });
    hp.innerHTML = '<div class="judul-sec"><p class="label">Produk digital</p><h1>Alat kerja akuntansi dan audit siap pakai</h1><p>Template Excel dan dokumen yang kami susun dari praktik audit dan pendampingan. Pembayaran dan pengiriman file diproses oleh Lynk.id.</p></div>' +
      (PRODUK.length ? (kel.length > 1 ? '<div class="ulasan-tab saring"><button type="button" class="aktif" data-k="">Semua</button>' + kel.map(function (k) { return '<button type="button" data-k="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="isi-produk"></div><p class="catatan-produk">Ada pertanyaan tentang isi produk, atau ingin membeli untuk banyak pengguna di lembaga Anda? <a href="index.html?lihat#kontak">Hubungi kami</a>.</p>'
        : '<p class="kosong-info">Belum ada produk. Silakan kembali lagi nanti.</p>');
    var isiP = hp.querySelector('.isi-produk');
    var saringP = function (k) {
      isiP.innerHTML = kel.filter(function (x) { return !k || x === k; }).map(function (x) {
        return '<section class="kelompok-produk"><h2>' + esc(x) + '</h2><div class="grid-produk">' + PRODUK.filter(function (p) { return (p.kelompok || 'Lainnya') === x; }).map(kartuProduk).join('') + '</div></section>';
      }).join('');
      hp.querySelectorAll('.saring button').forEach(function (t) { t.classList.toggle('aktif', t.getAttribute('data-k') === k); });
    };
    if (isiP) saringP('');
    hp.querySelectorAll('.saring button').forEach(function (t) { t.addEventListener('click', function () { saringP(t.getAttribute('data-k')); }); });
  }

  // Halaman berita.html: daftar semua berita, atau satu berita bila ada ?id=
  var hal = document.getElementById('berita-hal');
  if (!hal) return;
  var id = new URLSearchParams(location.search).get('id');
  var b = id && BERITA.filter(function (x) { return x.id === id; })[0];
  if (b) {
    document.title = b.judul + ' | ZeQui Consulting';
    var f = aman(b.foto);
    var galeri = (b.galeri || []).filter(function (g) { return aman(g.foto); });
    hal.innerHTML = '<article class="baca"><a class="kembali" href="berita.html">&larr; Semua berita</a>' +
      '<p class="kb-meta">' + esc(b.kategori || 'Berita') + ' &middot; ' + esc(tgl(b.tanggal)) + '</p><h1>' + esc(b.judul) + '</h1>' +
      (b.ringkasan ? '<p class="baca-ring">' + esc(b.ringkasan) + '</p>' : '') +
      (f ? '<figure class="baca-foto"><img src="' + esc(f) + '" alt="' + esc(b.ketFoto || b.judul) + '">' + (b.ketFoto ? '<figcaption>' + esc(b.ketFoto) + '</figcaption>' : '') + '</figure>' : '') +
      '<div class="baca-isi">' + isiHtml(b.isi) + '</div>' +
      (galeri.length ? '<div class="galeri">' + galeri.map(function (g) {
        return '<figure><a href="' + esc(g.foto) + '" target="_blank" rel="noopener"><img src="' + esc(g.foto) + '" alt="' + esc(g.ket || b.judul) + '" loading="lazy"></a>' + (g.ket ? '<figcaption>' + esc(g.ket) + '</figcaption>' : '') + '</figure>';
      }).join('') + '</div>' : '') +
      '<div class="baca-bawah"><button type="button" class="btn btn-garis js-bagikan">Bagikan berita ini</button><a class="btn btn-utama" href="index.html?lihat#kontak">Hubungi kami</a></div></article>';
    var tb = hal.querySelector('.js-bagikan');
    tb.addEventListener('click', function () {
      var data = { title: b.judul, url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      try { navigator.clipboard.writeText(location.href).then(function () { tb.textContent = 'Tautan disalin'; }); } catch (e) { prompt('Salin tautan ini:', location.href); }
    });
    return;
  }
  var kat = [];
  BERITA.forEach(function (x) { var k = x.kategori || 'Berita'; if (kat.indexOf(k) < 0) kat.push(k); });
  hal.innerHTML = '<div class="judul-sec"><p class="label">Berita</p><h1>Kabar dari ZeQui Consulting</h1><p>Kegiatan pelatihan, pendampingan, dan pembaruan aplikasi ZeQui.</p></div>' +
    (BERITA.length ? (kat.length > 1 ? '<div class="ulasan-tab saring"><button type="button" class="aktif" data-k="">Semua</button>' + kat.map(function (k) { return '<button type="button" data-k="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="grid-berita semua"></div>' : '<p class="kosong-info">Belum ada berita. Silakan kembali lagi nanti.</p>');
  var grid = hal.querySelector('.grid-berita');
  var saring = function (k) {
    grid.innerHTML = BERITA.filter(function (x) { return !k || (x.kategori || 'Berita') === k; }).map(kartuBerita).join('');
    hal.querySelectorAll('.saring button').forEach(function (t) { t.classList.toggle('aktif', t.getAttribute('data-k') === k); });
  };
  if (grid) saring('');
  hal.querySelectorAll('.saring button').forEach(function (t) { t.addEventListener('click', function () { saring(t.getAttribute('data-k')); }); });
})();

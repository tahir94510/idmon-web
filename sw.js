/**
 * Servis çalışanı: çevrimdışı çalışma ve önbellek.
 *
 * Strateji varlık türüne göre ayrılıyor, çünkü ihtiyaçlar farklı:
 *
 * * **HTML** — önce ağ, sonra önbellek. Sayfa iskeleti değiştiğinde kullanıcı
 *   eskisinde takılı kalmamalı; ağ yoksa önbellekteki sürüm verilir.
 * * **Varlıklar** (JS, CSS, yazı tipi, madde paketi, model) — önce önbellek.
 *   Hepsinin adında içerik özeti var ya da sürümle değişiyorlar, yani eskimiş
 *   bir dosyayı sunma riski yok. Model ve WASM 5,3 MB; her açılışta yeniden
 *   indirmek mobil veriyi boşa harcardı.
 *
 * Önbellek adı sürümlü: yeni sürüm etkinleşince eskiler siliniyor. Aksi hâlde
 * kullanıcının cihazında ölü paketler birikirdi.
 */

const VERSION = "idmon-01a6cb69d4";
const CACHE = `${VERSION}`;

/** Açılışta hazır olması gerekenler. Model ve WASM **yok**: onlar 24. soruda
 *  indiriliyor (MODEL_ESIGI) ve kurulumu geciktirmemeliler. */
const PRECACHE = [
  "./",
  "./index.html",
  "./calis.html",
  "./ilerleme.html",
  "./site.webmanifest",
  "./paket/taksonomi.json",
  "./paket/paket-000.json",
  "./engine.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // `reload`: kurulum sırasında tarayıcı önbelleğinden bayat kopya alınmasın.
      c.addAll(PRECACHE.map((response) => new Request(response, { cache: "reload" })))
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((a) => a !== CACHE).map((a) => caches.delete(a))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Yalnızca kendi kaynağımız: üçüncü taraf istekleri (hiç yok ama olursa)
  // önbelleğe alınmaz.
  if (url.origin !== self.location.origin) return;

  const isHtml = request.mode === "navigate"
    || (request.headers.get("accept") ?? "").includes("text/html");

  if (isHtml) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((c) => c.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((response) => response ?? caches.match("./index.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Yalnızca başarılı ve temel yanıtlar saklanır; hata sayfasını
        // önbelleğe almak, çevrimdışıyken kalıcı bir kusur üretirdi.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      });
    }),
  );
});

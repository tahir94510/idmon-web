// Üretilir: tools/mobile_web_sw.py. Elle düzenlenmez; gerekçeler orada.
const CACHE = "idmon-uygulama-75827e6c3a228f89";
const PRECACHE = ["./", "ayarlar", "calis", "deneme", "ilerleme", "_expo/static/js/web/entry-7cb721d8fe93a6a722368afe74679b37.js", "assets/assets/fonts/idmon-mono-400.2434100a30e47180c0d399ce9c744dc0.ttf", "assets/assets/fonts/idmon-sans-400.fe05e4d745a9724a985eb36a8a9ade02.ttf", "assets/assets/fonts/idmon-sans-500.8cf59e721b00acb98e57316312b719a1.ttf", "assets/assets/fonts/idmon-sans-600.5e828338fd44370f45e7bbf98ae30596.ttf", "assets/assets/paket/engine.17ace3310cef8fcd66f77c46e1a70ef4.pack", "assets/assets/paket/paket-000.1d6f4393ae1e5d449046e5acd1187bf7.pack", "assets/assets/paket/taksonomi.6ed4fd68ead9e55cd38b382693558dde.pack", "sw-kayit.js"];
const SCOPE = new URL("./", self.location).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names
      .filter((n) => n.startsWith("idmon-uygulama-") && n !== CACHE)
      .map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  if (request.mode === "navigate") {
    // Önce ağ: yeni sürüm bağlantı varken hemen görünsün. Yoksa saklanan
    // sayfa, o da yoksa kabuk (uygulama tek sayfa, rotayı kendisi çözüyor).
    event.respondWith(fetch(request, { cache: "no-cache" })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit ?? caches.match("./"))));
    return;
  }

  // Adlar içerik özeti taşıyor: önce önbellek, yoksa ağ ve sakla. Yalnız
  // başarılı ve temel yanıtlar: bir 404'ü saklamak kalıcı bir kusur olurdu.
  event.respondWith(caches.open(CACHE).then((cache) =>
    cache.match(request).then((hit) => hit ?? fetch(request).then((response) => {
      if (response.ok && response.type === "basic") void cache.put(request, response.clone());
      return response;
    }))));
});

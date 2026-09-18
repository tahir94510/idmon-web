/**
 * Servis çalışanı: çevrimdışı çalışma ve önbellek.
 *
 * ### Üç strateji, çünkü üç farklı tazelik ihtiyacı var
 *
 * * **HTML** — önce ağ (`no-cache` ile), sonra önbellek. Sayfa iskeleti
 *   değiştiğinde kullanıcı eskisinde takılı kalmamalı.
 * * **Sürümlü varlıklar** (JS, CSS, yazı tipi, ikon) — önce önbellek.
 *   Adlarında içerik özeti var, yani eski bir dosyayı sunma riski yok.
 * * **Sürümsüz veri** (madde paketi, `engine.json`, model, WASM) —
 *   **önce önbellek, arkada yenile** (stale-while-revalidate). Adlarında
 *   özet **yok**, yani "önce önbellek" onları süresiz eskitiyordu.
 *
 * ~~Hepsinin adında içerik özeti var ya da sürümle değişiyorlar, yani eskimiş
 * bir dosyayı sunma riski yok.~~ **Çürütüldü (Faz 19).** O cümle madde paketi,
 * `engine.json`, ONNX modeli ve WASM ikilileri için yanlıştı: dördünün de adı
 * sabit, dördü de her yayında yeniden üretiliyor, ve dördü de `cache-first`
 * ile **süresiz** bayat kalabiliyordu. Ölçülen sonucu şuydu: içerik yayını
 * (yeni maddeler, düzeltilmiş metin, yeni taksonomi) kurulu hiçbir
 * kullanıcıya **ulaşmıyordu**.
 *
 * ### İki önbellek, çünkü veri kümesi bir bütün
 *
 * Kabuk `VERSION` ile, veri `DATA_VERSION` ile adlandırılıyor. Veri
 * kümesinin (taksonomi + paket dilimleri + `engine.json`) parçaları birbirine
 * bağlı: paket taksonomiyle, model `engine.json`daki yuva sayılarıyla
 * anlamlı. Tek bir önbellekte dursalardı yarısı eski yarısı yeni olabilirdi
 * ve uygulama parmak izi uyuşmazlığıyla **hata ekranına** düşerdi. Ayrı ve
 * parmak iziyle adlandırılmış bir önbellekte ya hepsi eski, ya hepsi yeni.
 *
 * ### Sürümler elle yazılmıyor
 *
 * İkisini de `tools/sw_version.py` içerikten türetiyor. Elle artırılan bir
 * sürüm bu depoda iki kez unutuldu ve ikisinde de sessiz kaldı.
 */

const VERSION = "idmon-29cdda06ff";
const DATA_VERSION = "veri-6e3cc91ac8";
const SHELL = VERSION;
const DATA = `idmon-${DATA_VERSION}`;

/** Sürümsüz, her yayında yeniden üretilen veri. Adlarında içerik özeti yok. */
const DATA_DIR = ["paket", "model", "ort"];
const DATA_FILE = ["engine.json"];

/** Yol **parçalara ayrılarak** eşleşiyor, dize içinde aranarak değil.
 *
 *  İki sebep var. Birincisi: kökten başlayan bir dize (`"/paket/"`) bu depoda
 *  yasak — site bir alt dizinde yayımlanıyor ve `release-address` kapısı
 *  haklı olarak onu bir yol sanıp düşüyor. İkincisi daha sinsi: `includes`
 *  ile `"ort/"` aramak `support/` gibi bir yolu da yakalardı. */
const isData = (url) => {
  const parts = url.pathname.split("/");
  return parts.some((part) => DATA_DIR.includes(part))
    || DATA_FILE.includes(parts[parts.length - 1]);
};

/** Açılışta hazır olması gerekenler.
 *
 *  Model ve WASM **yok**: onlar 24. soruda iniyor (MODEL_THRESHOLD) ve
 *  kurulumu geciktirmemeliler. Sekiz sayfanın hepsi burada: üçü eksikti ve
 *  çevrimdışı açıldıklarında `index.html` dönüyordu — 404 değil, **yanlış
 *  sayfa**, ki sessiz olduğu için daha kötü. */
const SHELL_PRECACHE = [
  "./",
  "./index.html",
  "./calis.html",
  "./ilerleme.html",
  "./deneme.html",
  "./ornekler.html",
  "./gizlilik.html",
  "./site.webmanifest",
];

const DATA_PRECACHE = [
  "./paket/taksonomi.json",
  "./paket/paket-000.json",
  "./engine.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([
    // `reload`: kurulum sırasında tarayıcı önbelleğinden bayat kopya alınmasın.
    caches.open(SHELL).then((c) =>
      c.addAll(SHELL_PRECACHE.map((p) => new Request(p, { cache: "reload" })))),
    caches.open(DATA).then((c) =>
      c.addAll(DATA_PRECACHE.map((p) => new Request(p, { cache: "reload" })))),
  ]));
});

/**
 * Devir **kullanıcının kararı**.
 *
 * Burada `skipWaiting()` vardı ve kurulum biter bitmez çağrılıyordu. İki
 * sonucu vardı, ikisi de istenmeyen: (1) `activate` eski önbelleği siliyor,
 * yani açık duran sayfa hâlâ eski kodu koşarken istediği parça artık ne
 * önbellekte ne sunucuda — sayfa oturumun ortasında bozulabiliyordu; (2)
 * kullanıcıya hiçbir şey söylenmiyordu.
 *
 * Yeni sürüm artık **bekliyor**: açık sayfa kendi sürümüyle çalışmaya devam
 * ediyor, ve `sw-register.ts` bir bant çıkarıp devri kullanıcıya bırakıyor.
 *
 * Bunun bir bedeli vardı ve Faz 19'da kapatıldı: kullanıcı banda hiç
 * dokunmasa bile **veri** tazeleniyor artık, çünkü veri ayrı bir önbellekte
 * ve arkada yenileniyor. Yani devri ertelemek eski **kodda** kalmak demek,
 * eski **maddelerde** kalmak değil.
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL, DATA]);
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((a) => !keep.has(a)).map((a) => caches.delete(a))))
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
    // `no-cache`: "önce ağ" gerçekten önce ağ olsun. Öntanımlı HTTP
    // önbelleğiyle GitHub Pages'in `max-age=600`u araya giriyordu, yani
    // "taze" sayılan HTML on dakikaya kadar eski olabiliyordu — ve o hâliyle
    // çevrimdışı yedeğe yazılıyordu.
    event.respondWith(
      fetch(new Request(request, { cache: "no-cache" }))
        .then((response) => {
          // `response.ok` denetimi: bir 404 ya da dağıtım penceresindeki bir
          // 503 önbelleğe yazılırsa o adresin **kalıcı** çevrimdışı yedeği
          // olurdu. Varlık dalında bu denetim vardı, HTML dalında yoktu.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            event.waitUntil(caches.open(SHELL).then((c) => c.put(request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(request)
          .then((response) => response ?? caches.match("./index.html"))),
    );
    return;
  }

  if (isData(url)) {
    // Önce önbellek, **arkada yenile**. Kullanıcı beklemiyor (ilk soru eski
    // paketle de açılıyor) ama bayatlık bir açılışla sınırlanıyor: bir
    // sonraki açılışta yeni veri hazır.
    event.respondWith(
      caches.open(DATA).then((cache) =>
        cache.match(request).then((cached) => {
          const fresh = fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              void cache.put(request, response.clone());
            }
            return response;
          }).catch((error) => {
            if (cached) return cached;
            throw error;
          });
          // Arka plan yenilemesi yanıt döndükten sonra da sürsün.
          event.waitUntil(fresh.catch(() => undefined));
          return cached ?? fresh;
        })),
    );
    return;
  }

  event.respondWith(
    caches.open(SHELL).then((cache) =>
      cache.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Yalnızca başarılı ve temel yanıtlar saklanır; hata sayfasını
          // önbelleğe almak, çevrimdışıyken kalıcı bir kusur üretirdi.
          if (response.ok && response.type === "basic") {
            void cache.put(request, response.clone());
          }
          return response;
        });
      })),
  );
});

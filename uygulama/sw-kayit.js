// Üretilir: tools/mobile_web_sw.py.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/idmon-web/uygulama/sw.js").catch(() => {});
  });
}

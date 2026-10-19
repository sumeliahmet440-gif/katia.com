// Web sitesinde (Render) otomatik boş kalır. APK / yerel dosyada Render adresi kullanılır.
(function () {
  var RENDER = 'https://katia-ai-tr.onrender.com';
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  // Capacitor APK: https://localhost (port yok) -> Render. Bilgisayarda "node server.js" (localhost:3000) -> yerel sunucu.
  var web = /^https?:$/.test(location.protocol) && (!local || !!location.port);
  window.KATIA_SERVER = web ? '' : RENDER;
})();

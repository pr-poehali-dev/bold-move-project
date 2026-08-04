// Service worker: показывает свою офлайн-страницу вместо английской ошибки браузера,
// когда пользователь пытается открыть сайт без интернета.
// Ничего больше не кеширует — сайт всегда грузится свежим из сети.

const CACHE = "offline-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ASSETS = [OFFLINE_URL, "/offline.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Перехватываем только переходы по страницам (открытие сайта).
  // Запросы к бэкенду, картинкам и т.п. не трогаем — они работают как обычно.
  if (req.mode !== "navigate") return;

  event.respondWith(
    fetch(req).catch(() =>
      caches.match(OFFLINE_URL).then((r) => r || Response.error())
    )
  );
});

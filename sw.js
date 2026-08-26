// sw.js —— Service Worker：缓存全部静态资源，让 App 离线可用
const CACHE_NAME = 'ledger-app-v19';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/main.mjs',
  './js/ui.mjs',
  './js/db.mjs',
  './js/stat.mjs',
  './js/render.mjs',
  './js/numpad.mjs',
  './js/validate.mjs',
  './js/url.mjs',
  './js/backup.mjs',
  './js/icons.mjs',
  './js/nav.mjs',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先：联网时总是拉取最新版本（开发迭代时能即时看到改动）；
// 断网时回退到缓存，保证离线可用。快捷指令带参 URL 也能加载。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});

// sw.js —— Service Worker：缓存全部静态资源，让 App 离线可用
const CACHE_NAME = 'ledger-app-v20';
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

// 缓存优先（stale-while-revalidate）：打开时直接用本地缓存秒开，
// 同时后台静默更新缓存；断网也能用；快捷指令带参 URL 通过 ignoreSearch 命中首页缓存。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      // 后台更新：网络成功就把最新内容写回缓存（不阻塞本次响应）
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      // 有缓存直接返回缓存（秒开）；没有缓存才等网络
      return cached || network;
    })
  );
});

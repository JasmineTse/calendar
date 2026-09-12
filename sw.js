// Service Worker：离线缓存 + 可安装为桌面应用
const CACHE = 'wnl-cache-v1';
const CORE = [
  './',
  'index.html',
  'css/style.css',
  'js/lib/lunar.js',
  'js/dates.js',
  'js/store.js',
  'js/holidays.js',
  'js/holiday-sync.js',
  'js/period.js',
  'js/events.js',
  'js/lunar-adapter.js',
  'js/tips.js',
  'js/notify.js',
  'js/state.js',
  'js/views.js',
  'js/app.js',
  'data/holidays.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(CORE.map(u => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// 网络优先，失败回退缓存（保证更新及时，离线也能用）
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => { });
      return res;
    }).catch(() => caches.match(req).then(m => m || caches.match('./')))
  );
});

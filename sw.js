// HYROX 训练计划 Service Worker（手写，无依赖）
// 策略：导航请求 network-first（离线回退缓存），同源静态资源 cache-first（运行时缓存带哈希的构建产物），
// api.github.com 永不缓存。更新缓存版本号即可整体失效旧缓存。
const VERSION = 'hyrox-pwa-v1-20260723'
const PRECACHE = ['index.html', 'manifest.webmanifest']
const NEVER_CACHE = ['api.github.com']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return
  if (NEVER_CACHE.some((h) => url.hostname.includes(h))) return // 直连，不缓存

  // 页面导航：network-first，离线回退缓存的 index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(VERSION).then((cache) => cache.put('index.html', clone))
          return res
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match(event.request))),
    )
    return
  }

  // 同源静态资源：cache-first，命中网络后写入运行时缓存
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(VERSION).then((cache) => cache.put(event.request, clone))
            }
            return res
          }),
      ),
    )
  }
})

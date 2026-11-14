const CACHE_NAME = 'kalpten-kaleme-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './index.html?mode=desktop',
  './styles.css',
  './app.js',
  './word-editor.js',
  './pdf-editor.js',
  './pdf-tools.js',
  './ppt-editor.js',
  './manifest.json',
  './app.png',
  './icon-192.png',
  './favicon.ico',
  './docx_file.png',
  './pdf_file.png',
  './pptx_file.png',
  './tools_file.png',
  './vendor/mammoth.browser.min.js',
  './vendor/html-docx.js',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './vendor/pdf-lib.min.js',
  './vendor/jszip.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('.zip') || url.pathname.endsWith('.apk') || url.pathname.startsWith('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html'))
      )
  );
});

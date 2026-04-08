/* HidroFlow Service Worker
 * Cache version is injected by GitHub Actions on every deploy.
 * CACHE_VERSION placeholder → replaced with git SHA short ref.
 */
const CACHE_VERSION = '__SW_VERSION__';
const CACHE_NAME = `hidroflow-${CACHE_VERSION}`;

/* Static assets to precache on install */
const PRECACHE_URLS = [
  './',
  './index.html',
  './sobre.html',
  './contato.html',
  './metodologia.html',
  './privacidade.html',
  './termos.html',
  './manifest.json',
  './responsive.css',
  './css/variables.css',
  './css/layout.css',
  './css/forms.css',
  './css/components.css',
  './css/domain.css',
  './css/print.css',
  './css/footer.css',
  './js/api.js',
  './js/aducao.js',
  './js/census.js',
  './js/comparison.js',
  './js/config.js',
  './js/decision.js',
  './js/eventos.js',
  './js/infra.js',
  './js/main.js',
  './js/map.js',
  './js/models.js',
  './js/network.js',
  './js/projection.js',
  './js/projects.js',
  './js/report.js',
  './js/saturacao.js',
  './js/state.js',
  './js/tabs.js',
  './js/utils.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/tarifas-aneel.json',
  './guia.html',
  './novidades.html',
  './disclaimer.html',
  './js/pdf.js',
  './js/worker-hardy-cross.js',
  './js/avancados.js',
];

/* External CDN resources cached on first use */
const CDN_CACHE = 'hidroflow-cdn';

var MAX_CDN_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const CDN_ORIGINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/* ── Install: precache static shell ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS)
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== CDN_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
    .then(() => {
      // BACKGROUND_SYNC: Future enhancement - use Background Sync API for offline save queuing
      // Clear CDN cache entries older than 7 days
      return caches.open(CDN_CACHE).then((cache) =>
        cache.keys().then((keys) =>
          Promise.all(keys.map((req) =>
            cache.match(req).then((res) => {
              if(!res) return cache.delete(req);
              var dateHeader = res.headers.get('date');
              if(dateHeader){
                var age = Date.now() - new Date(dateHeader).getTime();
                if(age > MAX_CDN_AGE_MS) return cache.delete(req);
              }
              return Promise.resolve();
            })
          ))
        )
      );
    })
  );
});

/* ── Fetch: cache strategies ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET requests entirely */
  if (request.method !== 'GET') return;

  const isApiCall =
    url.hostname === 'servicodados.ibge.gov.br' ||
    url.hostname === 'apisidra.ibge.gov.br' ||
    url.hostname === 'nominatim.openstreetmap.org';

  /* Let live API calls go straight to the network (no caching) */
  if (isApiCall) return;

  const isCDN = CDN_ORIGINS.some((o) => url.hostname.includes(o));

  if (isCDN) {
    /* Stale-while-revalidate for CDN assets */
    event.respondWith(
      caches.open(CDN_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  /* Cache-first for local static assets */
  event.respondWith(
    caches.match(request).then(
      (cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
        }
        return response;
      }).catch(() => new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
    )
  );
});

// Offline režim kartiček: soubory aplikace se uloží do mezipaměti, takže kartičky i lekce fungují bez internetu.
// Při každé nové verzi aplikace zvyš CACHE_VERSION, aby si zařízení stáhla nové soubory.
const CACHE_VERSION = 'karticky-v56';
// Celá aplikace (kartičky, lekce sloves, ikona) je v jednom souboru index.html.
const APP_FILES = [
  './',
  'index.html'
];
// Knihovna pro synchronizaci; bez ní kartičky fungují, jen bez přihlášení.
const LIBRARY = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Každý soubor zvlášť: když jeden (např. adresa složky „./“) nejde stáhnout, ostatní se uloží.
    for (const file of APP_FILES) { try { await cache.add(file); } catch (e) { /* uloží se při první návštěvě */ } }
    try { await cache.add(LIBRARY); } catch (e) { /* offline při instalaci – knihovna se uloží později */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE_VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Přihlášení a ukládání výsledků (Supabase API) jdou vždy přímo na server, nikdy z mezipaměti.
  if (!sameOrigin && req.url !== LIBRARY) return;

  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    // Stránky: nejdřív síť (aby se projevily nové verze), bez připojení uložená kopie.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const fresh = await fetch(req, { cache: 'no-cache' });
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html'));
      }
    })());
    return;
  }

  // Ostatní soubory (ikony, knihovna): z mezipaměti, jinak ze sítě a uložit.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  })());
});

/* Estrategia mixta, para que una version nueva llegue sola:
   - El HTML (y cualquier navegacion) va primero a la red. Si la red
     responde, se guarda y se sirve; si no hay cobertura, cae a la cache.
     Asi publicar una version nueva ya no exige tocar CACHE a mano.
   - El resto de estaticos van primero a cache (arranque instantaneo) y se
     refrescan de fondo para la proxima visita. */
const CACHE = 'finanzas-2.64';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

const esDocumento = req =>
  req.mode === 'navigate' ||
  (req.headers.get('accept')||'').includes('text/html');

async function redPrimero(req){
  try{
    const res = await fetch(req);
    // Solo se cachean respuestas buenas: un 404 o un error del proxy
    // guardado en cache se quedaria pegado igual que la version vieja.
    if(res && res.ok){
      const clone = res.clone();
      caches.open(CACHE).then(c=>c.put(req, clone));
    }
    return res;
  }catch(e){
    const cached = await caches.match(req) || await caches.match('./index.html');
    if(cached) return cached;
    throw e;
  }
}

async function cachePrimero(req){
  const cached = await caches.match(req);
  const red = fetch(req).then(res=>{
    if(res && res.ok){
      const clone = res.clone();
      caches.open(CACHE).then(c=>c.put(req, clone));
    }
    return res;
  }).catch(()=> cached);
  return cached || red;
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  // Firebase, Firestore y cualquier POST se dejan pasar sin tocar: no son
  // estaticos y cachearlos rompe la sincronizacion.
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(esDocumento(req) ? redPrimero(req) : cachePrimero(req));
});

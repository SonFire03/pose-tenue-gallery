const CACHE='pose-tenue-v2';
const CORE=['./','./index.html','./gallery-data.json','./manifest.webmanifest','./icons/app-192.png','./icons/app-512.png','./icons/apple-touch.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pose-tenue-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;event.respondWith(fetch(request).then(response=>{if(response.ok&&request.url.includes('/assets/')){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}return response}).catch(()=>caches.match(request).then(cached=>cached||Response.error())))});

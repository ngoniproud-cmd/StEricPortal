// Offline support: app shell + last-seen data. Cleared on sign-out (see session.clear).
const SHELL = "shell-v1", API = "api-v1";
const CACHEABLE = [/^\/api\/v1\/(dashboard|report-cards\/[^/]+$|announcements|library$|library\?|subjects|classes)/];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(["/", "/manifest.webmanifest"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== API).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.startsWith("/api/")) {
    if (!CACHEABLE.some(re => re.test(u.pathname + u.search)) || /\/(view|download|pdf)$/.test(u.pathname)) return;
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(API).then(x => x.put(r, c)); } return res; }).catch(() => caches.match(r)));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok && u.pathname.startsWith("/assets/")) { const c = res.clone(); caches.open(SHELL).then(x => x.put(r, c)); } return res; })
    .catch(() => caches.match("/"))));
});

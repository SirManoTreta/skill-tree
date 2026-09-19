import { createHash } from 'node:crypto';

// Cache every local build chunk, including lazy pages, so navigation works offline.
export default function offlinePlugin() {
  return {
    name: 'hability-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter(name => /\.(html|js|css|svg|png|ico)$/.test(name)).sort();
      const hash = createHash('sha256');
      for (const file of files) {
        const entry = bundle[file];
        hash.update(file).update(entry.type === 'chunk' ? entry.code : entry.source);
      }
      const version = hash.digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: workerSource(files, version) });
    },
  };
}

export function workerSource(files, version) {
  return `const PREFIX = 'hability:' + self.registration.scope + ':';
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)}.map(file => new URL(file, self.registration.scope).href);
const INDEX = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const isEntry = event.request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(INDEX).pathname);
  if (!isEntry && !FILES.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(isEntry ? INDEX : url.href, { ignoreVary: true })) || fetch(event.request)));
});
`;
}

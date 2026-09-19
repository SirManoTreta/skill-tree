import vm from 'node:vm';
import { expect, it, vi } from 'vitest';
import { workerSource } from '../build/offline';

it('preloads lazy pages under the deployment path and serves them with no network', async () => {
  const handlers = {};
  const entries = new Map();
  const scope = 'https://example.test/skill-tree/';
  const cached = { text: 'offline content' };
  const cache = {
    addAll: vi.fn(async urls => urls.forEach(url => entries.set(url, cached))),
    match: vi.fn(async request => entries.get(typeof request === 'string' ? request : request.url)),
  };
  const caches = { open: vi.fn(async () => cache), keys: async () => ['unrelated-app', `hability:${scope}:old`], delete: vi.fn() };
  const fetch = vi.fn(() => Promise.reject(new Error('offline')));
  const self = { registration: { scope }, location: { origin: 'https://example.test' },
    clients: { claim: vi.fn() }, addEventListener: (type, handler) => { handlers[type] = handler; } };
  vm.runInNewContext(workerSource(['index.html', 'assets/progression.js', 'assets/sheet.js'], 'new'), { self, caches, fetch, URL });
  let pending;
  handlers.install({ waitUntil: promise => { pending = promise; } }); await pending;
  expect(entries.has(`${scope}assets/progression.js`)).toBe(true);
  handlers.fetch({ request: { url: scope, method: 'GET', mode: 'navigate' }, respondWith: promise => { pending = promise; } });
  expect(await pending).toBe(cached);
  handlers.fetch({ request: { url: `${scope}assets/progression.js`, method: 'GET' }, respondWith: promise => { pending = promise; } });
  expect(await pending).toBe(cached);
  expect(cache.match).toHaveBeenLastCalledWith(`${scope}assets/progression.js`, { ignoreVary: true });
  expect(fetch).not.toHaveBeenCalled();
  handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
  expect(caches.delete).toHaveBeenCalledExactlyOnceWith(`hability:${scope}:old`);
  const respondWith = vi.fn();
  handlers.fetch({ request: { url: 'https://external.test/image.png', method: 'GET' }, respondWith });
  handlers.fetch({ request: { url: 'https://example.test/other-app/', method: 'GET', mode: 'navigate' }, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
});

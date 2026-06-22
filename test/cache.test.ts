import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SummaryCache, type KeyValueStore } from '../src/core/cache.js';

interface FakeStore extends KeyValueStore {
  readonly map: Map<string, string>;
}

function fakeStore(): FakeStore {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k),
    set: (k, v) => {
      map.set(k, v);
    },
    delete: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()],
  };
}

test('stores and retrieves by hash, language and maxLength', async () => {
  const cache = new SummaryCache(fakeStore());
  await cache.set('h1', 'auto', 100, { summary: 'summary' });
  assert.equal(cache.get('h1', 'auto', 100)?.summary, 'summary');
});

test('round-trips a translated body', async () => {
  const cache = new SummaryCache(fakeStore());
  await cache.set('h1', 'ru', 100, { summary: 'кратко', body: 'полный текст' });
  const entry = cache.get('h1', 'ru', 100);
  assert.equal(entry?.summary, 'кратко');
  assert.equal(entry?.body, 'полный текст');
});

test('a different maxLength is a cache miss', async () => {
  const cache = new SummaryCache(fakeStore());
  await cache.set('h1', 'auto', 100, { summary: 's' });
  assert.equal(cache.get('h1', 'auto', 80), undefined);
});

test('a different language is a cache miss', async () => {
  const cache = new SummaryCache(fakeStore());
  await cache.set('h1', 'auto', 100, { summary: 's' });
  assert.equal(cache.get('h1', 'ru', 100), undefined);
});

test('clear removes only Squint keys', async () => {
  const store = fakeStore();
  const cache = new SummaryCache(store);
  await cache.set('h1', 'auto', 100, { summary: 's' });
  store.set('unrelated.key', 'keep');
  await cache.clear();
  assert.equal(cache.get('h1', 'auto', 100), undefined);
  assert.equal(store.get('unrelated.key'), 'keep');
});

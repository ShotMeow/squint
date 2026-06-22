import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Semaphore } from '../src/core/semaphore.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('runs at most N tasks concurrently', async () => {
  const sem = new Semaphore(2);
  let active = 0;
  let peak = 0;
  const task = async () => {
    active += 1;
    peak = Math.max(peak, active);
    await delay(10);
    active -= 1;
  };
  await Promise.all(Array.from({ length: 6 }, () => sem.run(task)));
  assert.ok(peak <= 2, `peak concurrency ${peak} should be <= 2`);
  assert.equal(active, 0);
});

test('returns the callback result and releases on throw', async () => {
  const sem = new Semaphore(1);
  assert.equal(await sem.run(async () => 42), 42);
  await assert.rejects(sem.run(async () => {
    throw new Error('boom');
  }));
  // Permit was released despite the throw — the next task still runs.
  assert.equal(await sem.run(async () => 'ok'), 'ok');
});

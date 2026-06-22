import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSummaryResponse } from '../src/core/summarize/parse.js';

const ids = new Set(['a', 'b']);

test('parses a clean JSON array', () => {
  const m = parseSummaryResponse('[{"id":"a","summary":"hi"},{"id":"b","summary":"yo"}]', ids, 100);
  assert.equal(m.get('a')?.summary, 'hi');
  assert.equal(m.get('b')?.summary, 'yo');
});

test('parses an optional translated body', () => {
  const m = parseSummaryResponse('[{"id":"a","summary":"кратко","body":"полный текст"}]', ids, 100);
  assert.equal(m.get('a')?.summary, 'кратко');
  assert.equal(m.get('a')?.body, 'полный текст');
});

test('tolerates code fences and preamble', () => {
  const raw = 'Sure!\n```json\n[{"id":"a","summary":"x"}]\n```';
  const m = parseSummaryResponse(raw, ids, 100);
  assert.equal(m.get('a')?.summary, 'x');
  assert.equal(m.get('a')?.body, undefined);
});

test('drops unknown ids', () => {
  const m = parseSummaryResponse('[{"id":"zzz","summary":"x"}]', ids, 100);
  assert.equal(m.size, 0);
});

test('clamps to maxLength and collapses to a single line', () => {
  const m = parseSummaryResponse('[{"id":"a","summary":"line1\\nline2 with extra words"}]', ids, 10);
  const value = m.get('a')?.summary;
  assert.ok(value !== undefined);
  assert.ok(value.length <= 10);
  assert.ok(!value.includes('\n'));
});

test('malformed or empty input yields an empty map', () => {
  assert.equal(parseSummaryResponse('not json at all', ids, 100).size, 0);
  assert.equal(parseSummaryResponse('', ids, 100).size, 0);
  assert.equal(parseSummaryResponse('{"id":"a"}', ids, 100).size, 0);
});

test('ignores entries with non-string fields', () => {
  const m = parseSummaryResponse('[{"id":"a","summary":123},{"id":5,"summary":"x"}]', ids, 100);
  assert.equal(m.size, 0);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJsDoc } from '../src/core/comments/jsdoc.js';

test('parses description and tags from a JSDoc block', () => {
  const raw = [
    '/**',
    ' * Validates the charge.',
    ' * Second line of description.',
    ' *',
    ' * @param amount - minor units to charge',
    ' * @returns whether it was authorized',
    ' */',
  ].join('\n');
  const doc = parseJsDoc(raw);
  assert.equal(doc.description, 'Validates the charge. Second line of description.');
  assert.equal(doc.tags.length, 2);
  assert.deepEqual(doc.tags[0], { tag: 'param', name: 'amount', text: 'minor units to charge' });
  assert.deepEqual(doc.tags[1], { tag: 'returns', text: 'whether it was authorized' });
});

test('a plain comment has no tags', () => {
  const doc = parseJsDoc('// just a note\n// across two lines');
  assert.equal(doc.tags.length, 0);
  assert.equal(doc.description, 'just a note across two lines');
});

test('folds a multi-line tag description', () => {
  const raw = ['/**', ' * @param x the value', ' *   continued here', ' */'].join('\n');
  const doc = parseJsDoc(raw);
  assert.equal(doc.tags.length, 1);
  assert.equal(doc.tags[0].text, 'the value continued here');
});

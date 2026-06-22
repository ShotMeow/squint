import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MARKERS, detectMarker, stripLeadingMarker } from '../src/core/comments/markers.js';

const M = DEFAULT_MARKERS;

test('detects a leading marker in a line comment', () => {
  assert.equal(detectMarker('// TODO: refactor this', M), 'TODO');
  assert.equal(detectMarker('# FIXME broken', M), 'FIXME');
});

test('detects a marker in a JSDoc block', () => {
  assert.equal(detectMarker('/**\n * HACK: works for now\n */', M), 'HACK');
});

test('is case-insensitive and respects word boundaries', () => {
  assert.equal(detectMarker('// todo something', M), 'TODO');
  assert.equal(detectMarker('// NOTEBOOK is not a marker', M), undefined);
});

test('ignores markers that are not leading', () => {
  assert.equal(detectMarker('// see the TODO below', M), undefined);
});

test('strips a leading marker from a summary', () => {
  assert.equal(stripLeadingMarker('TODO: rewrite auth flow', M), 'rewrite auth flow');
  assert.equal(stripLeadingMarker('rewrite auth flow', M), 'rewrite auth flow');
});

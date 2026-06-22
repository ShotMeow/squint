import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSummaryPrompt } from '../src/core/summarize/prompt.js';

const items = [{ id: '0:0', text: '// hello' }];

test('auto keeps the original language', () => {
  const { system } = buildSummaryPrompt(items, 100, 'auto');
  assert.match(system, /same natural language/i);
});

test('a language code translates summaries into that language', () => {
  const { system } = buildSummaryPrompt(items, 100, 'ru');
  assert.match(system, /Russian/);
  assert.match(system, /regardless of the comment's original language/i);
});

test('an unknown code is passed through verbatim', () => {
  const { system } = buildSummaryPrompt(items, 100, 'tlh');
  assert.match(system, /in tlh/);
});

test('the max length is stated in the prompt', () => {
  const { system } = buildSummaryPrompt(items, 80, 'auto');
  assert.match(system, /80 characters/);
});

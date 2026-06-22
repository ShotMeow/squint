import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  groupAdjacentComments,
  isSummarizable,
  type CommentNodeLike,
  type RawComment,
} from '../src/core/comments/grouping.js';

function node(startRow: number, endRow: number, text: string, standalone = true): CommentNodeLike {
  return {
    type: 'comment',
    text,
    startPosition: { row: startRow, column: standalone ? 0 : 8 },
    endPosition: { row: endRow, column: text.length },
    standalone,
  };
}

test('merges adjacent line comments into one block', () => {
  const groups = groupAdjacentComments([node(0, 0, '// a'), node(1, 1, '// b'), node(2, 2, '// c')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].lineCount, 3);
  assert.equal(groups[0].text, '// a\n// b\n// c');
});

test('splits the run on a blank/code gap', () => {
  const groups = groupAdjacentComments([node(0, 0, '// a'), node(2, 2, '// b')]);
  assert.equal(groups.length, 2);
});

test('never merges inline comments (they sit after code)', () => {
  const groups = groupAdjacentComments([
    node(0, 0, '// a', false),
    node(1, 1, '// b', false),
    node(2, 2, '// c', false),
  ]);
  assert.equal(groups.length, 3);
});

test('does not merge an inline comment into a standalone run', () => {
  const groups = groupAdjacentComments([node(0, 0, '// a', true), node(1, 1, '// b', false)]);
  assert.equal(groups.length, 2);
});

test('a multi-line block comment stands alone', () => {
  const groups = groupAdjacentComments([node(0, 3, '/* multi\n * line\n * block\n */')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].lineCount, 4);
});

test('input order does not matter', () => {
  const groups = groupAdjacentComments([node(2, 2, '// c'), node(0, 0, '// a'), node(1, 1, '// b')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].startLine, 0);
  assert.equal(groups[0].endLine, 2);
});

const sample = (lineCount: number, charCount: number): RawComment => ({
  startLine: 0,
  endLine: lineCount - 1,
  startChar: 0,
  endChar: 0,
  text: '',
  lineCount,
  charCount,
});

test('isSummarizable triggers on lines OR chars', () => {
  assert.equal(isSummarizable(sample(3, 10), { minLines: 3, minChars: 200 }), true);
  assert.equal(isSummarizable(sample(1, 250), { minLines: 3, minChars: 200 }), true);
  assert.equal(isSummarizable(sample(1, 10), { minLines: 3, minChars: 200 }), false);
});

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { CommentParser } from '../src/core/comments/parser.js';

// Relies on `pretest` having copied the wasm files into dist/wasm.
const grammarDir = join(process.cwd(), 'dist', 'wasm');
const parser = new CommentParser({
  runtimeWasmPath: join(grammarDir, 'web-tree-sitter.wasm'),
  grammarDir,
});

test('extracts a block comment and a separate line-comment run (TS)', async () => {
  const code = [
    '/**',
    ' * Long block doc.',
    ' * Second line.',
    ' */',
    'function f() {}',
    '// a',
    '// b',
    '// c',
    'const x = 1;',
  ].join('\n');
  const comments = await parser.parse('typescript', code);
  assert.equal(comments.length, 2);
  assert.equal(comments[0].startLine, 0);
  assert.equal(comments[0].endLine, 3);
  assert.equal(comments[1].startLine, 5);
  assert.equal(comments[1].endLine, 7);
  assert.equal(comments[1].lineCount, 3);
});

test('handles Rust line and block comment node types', async () => {
  const comments = await parser.parse('rust', '// one\n/* two */\nfn main() {}');
  // Adjacent comments on consecutive lines merge into one block.
  assert.equal(comments.length, 1);
  assert.equal(comments[0].startLine, 0);
  assert.equal(comments[0].endLine, 1);
});

test('populates id and content hash', async () => {
  const comments = await parser.parse('python', '# line one\n# line two');
  assert.equal(comments.length, 1);
  assert.equal(comments[0].id, '0:0');
  assert.ok(comments[0].hash.length > 0);
});

test('returns nothing for an unsupported language', async () => {
  const comments = await parser.parse('plaintext', '# not parsed');
  assert.equal(comments.length, 0);
});

test('parses Go comments', async () => {
  const comments = await parser.parse('go', '// Package doc\n// continued\npackage main');
  assert.equal(comments.length, 1);
  assert.equal(comments[0].lineCount, 2);
});

test('parses Java Javadoc (line + block comment types)', async () => {
  const comments = await parser.parse('java', '/**\n * Javadoc.\n */\nclass A {}');
  assert.equal(comments.length, 1);
  assert.equal(comments[0].lineCount, 3);
});

test('parses C# comments', async () => {
  const comments = await parser.parse('csharp', '/// <summary>doc</summary>\n/// more\nclass A {}');
  assert.equal(comments.length, 1);
  assert.equal(comments[0].lineCount, 2);
});

test('parses PHP comments', async () => {
  const comments = await parser.parse('php', '<?php\n/**\n * Doc\n */\nfunction a() {}');
  assert.equal(comments.length, 1);
});

test('parses TSX (React) comments', async () => {
  const comments = await parser.parse('typescriptreact', '/**\n * Component.\n */\nexport const A = () => null;');
  assert.equal(comments.length, 1);
});

test('parses Ruby and C/C++ comments', async () => {
  assert.equal((await parser.parse('ruby', '# one\n# two\ndef a; end')).length, 1);
  assert.equal((await parser.parse('c', '/* one\n   two */\nint main(){}')).length, 1);
  assert.equal((await parser.parse('cpp', '// one\n// two\nint main(){}')).length, 1);
});

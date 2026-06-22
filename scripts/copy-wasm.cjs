// Copies the web-tree-sitter runtime and the grammar wasm files into a single
// flat directory so both the bundled extension and the unit tests can resolve
// them from one place. Run directly (writes to dist/wasm) or via copyWasm().
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Each entry: [npm package, wasm filename within that package]. */
const WASM_FILES = [
  ['web-tree-sitter', 'web-tree-sitter.wasm'],
  ['tree-sitter-typescript', 'tree-sitter-typescript.wasm'],
  ['tree-sitter-typescript', 'tree-sitter-tsx.wasm'],
  ['tree-sitter-javascript', 'tree-sitter-javascript.wasm'],
  ['tree-sitter-python', 'tree-sitter-python.wasm'],
  ['tree-sitter-go', 'tree-sitter-go.wasm'],
  ['tree-sitter-rust', 'tree-sitter-rust.wasm'],
  ['tree-sitter-java', 'tree-sitter-java.wasm'],
  ['tree-sitter-c-sharp', 'tree-sitter-c_sharp.wasm'],
  ['tree-sitter-c', 'tree-sitter-c.wasm'],
  ['tree-sitter-cpp', 'tree-sitter-cpp.wasm'],
  ['tree-sitter-php', 'tree-sitter-php.wasm'],
  ['tree-sitter-ruby', 'tree-sitter-ruby.wasm'],
];

function resolvePackageFile(pkg, file) {
  // Resolve the wasm directly. web-tree-sitter exposes it via package exports;
  // the grammar packages have no exports field, so filesystem resolution works.
  return require.resolve(`${pkg}/${file}`);
}

/** Copy every wasm file into `outDir`, returning the list of destinations. */
function copyWasm(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const [pkg, file] of WASM_FILES) {
    const src = resolvePackageFile(pkg, file);
    const dest = path.join(outDir, file);
    fs.copyFileSync(src, dest);
    written.push(dest);
  }
  return written;
}

module.exports = { copyWasm, WASM_FILES };

if (require.main === module) {
  const outDir = path.resolve(__dirname, '..', 'dist', 'wasm');
  const written = copyWasm(outDir);
  console.log(`Copied ${written.length} wasm files to ${outDir}`);
}

// Build script: copies wasm assets, then bundles the extension with esbuild.
'use strict';

const esbuild = require('esbuild');
const path = require('node:path');
const { copyWasm } = require('./scripts/copy-wasm.cjs');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

async function main() {
  const wasmOut = path.resolve(__dirname, 'dist', 'wasm');
  const written = copyWasm(wasmOut);
  console.log(`[wasm] copied ${written.length} files`);

  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    sourcemap: !production,
    minify: production,
    // `vscode` is provided by the host. `web-tree-sitter` is kept external and
    // shipped as-is: bundling its emscripten glue breaks wasm loading (the ESM
    // variant relies on import.meta.url, which is undefined once bundled to CJS).
    external: ['vscode', 'web-tree-sitter'],
    logLevel: 'info',
  });

  if (watch) {
    await ctx.watch();
    console.log('[esbuild] watching…');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('[esbuild] build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

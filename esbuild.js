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
    // `vscode` is provided by the host. web-tree-sitter is bundled from its CJS
    // build (which uses __dirname, not import.meta.url, so it survives bundling);
    // the wasm is handed in as bytes at runtime, so no files need to ship beside
    // it. This keeps the extension dependency-free for packaging.
    external: ['vscode'],
    alias: { 'web-tree-sitter': require.resolve('web-tree-sitter') },
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

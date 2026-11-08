import { build } from 'esbuild';

// Bundles src/offscreen.js → offscreen.bundle.js (single ESM file, no .wasm
// assets: hachiue's WebGPU path is pure JS generation + WebGPU calls).
await build({
    entryPoints: ['src/offscreen.js'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome120',
    minify: true,
    sourcemap: false,
    outfile: 'offscreen.bundle.js',
    legalComments: 'linked',
    logLevel: 'info',
});

console.log('build complete -> offscreen/offscreen.bundle.js');

// Builds the host half and the browser half, plus local overlays for `dsh web --patch`.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const { name } = JSON.parse(readFileSync('package.json', 'utf8'))

// Modules the dsh Web shell shares with every client plugin; they resolve at runtime.
const PLATFORM = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit',
]

// The sandbox worker is one self-contained script, carried inside the browser half as a string.
const worker = await build({
  entryPoints: ['src/dil/worker.ts'], bundle: true, format: 'iife', minify: true, write: false,
})

await Promise.all([
  // Host half: ESM whose dsh imports resolve to the running host's packages.
  build({
    entryPoints: ['src/host/index.ts'], outfile: 'lib/index.js',
    bundle: true, format: 'esm', platform: 'node', packages: 'external', loader: { '.dil': 'text' },
  }),
  // Browser half: a CommonJS factory registered with dsh's lazy module loader.
  build({
    entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js',
    bundle: true, format: 'cjs', platform: 'browser', jsx: 'automatic', external: PLATFORM,
    loader: { '.css': 'text' }, define: { __WORKER__: JSON.stringify(worker.outputFiles[0].text) },
    banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
    footer: { js: 'return module.exports;}});' },
  }),
])

// An overlay names its plugins by absolute path, so the two are generated per checkout:
// the plugin itself, and optionally a scripted model that needs no API key.
const row = (id, file) => `    - id: ${id}\n      name: ${JSON.stringify(resolve(file))}\n`
writeFileSync('dev.patch.yml', `- insert:\n${row('intelligent-ui', 'lib/index.js')}`)
writeFileSync('dev.scripted.patch.yml', `- insert:\n${row('scripted-llm', 'dev/scripted-llm.ts')}`
  + '- id: agent-default-model\n  config:\n    provider: scripted\n    model: scripted\n')

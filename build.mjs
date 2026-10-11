// 构建宿主端和浏览器端，并生成本地开发用的 `dsh --patch` 配置。
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const { name } = JSON.parse(readFileSync('package.json', 'utf8'))

// dsh Web 与所有浏览器端插件共用的模块：运行时由 dsh 提供，不打进包里。
const PLATFORM = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit',
]

// 沙箱 Worker 是一份独立的脚本，以字符串的形式内联到浏览器端的包里。
const worker = await build({
  entryPoints: ['src/dil/worker.ts'], bundle: true, format: 'iife', minify: true, write: false,
})

await Promise.all([
  // 宿主端：ESM，其中对 dsh 包的引用在运行时指向 dsh 自己的包。
  build({
    entryPoints: ['src/host/index.ts'], outfile: 'lib/index.js',
    bundle: true, format: 'esm', platform: 'node', packages: 'external', loader: { '.dil': 'text' },
  }),
  // 浏览器端：一个 CommonJS 工厂函数，注册到 dsh 的懒加载模块加载器上。
  build({
    entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js',
    bundle: true, format: 'cjs', platform: 'browser', jsx: 'automatic', external: PLATFORM,
    loader: { '.css': 'text' }, define: { __WORKER__: JSON.stringify(worker.outputFiles[0].text) },
    banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
    footer: { js: 'return module.exports;}});' },
  }),
])

// 配置里的插件要用绝对路径指定，所以这两个文件在每份代码里各自生成：
// 一个加载插件本身，另一个可选，换成不需要 API key 的假模型。
const overlay = (purpose, id, file) =>
  `# 由 build.mjs 生成，供 \`dsh --patch\` 使用。${purpose}\n- insert:\n    - id: ${id}\n      name: ${JSON.stringify(resolve(file))}\n`
writeFileSync('dev.patch.yml', overlay('加载本地构建出的插件。', 'intelligent-ui', 'lib/index.js'))
writeFileSync('dev/use-mock-model.patch.yml', overlay('用 dev/mock-model.ts 这个假模型代替真实模型。', 'mock-model', 'dev/mock-model.ts')
  + '- id: agent-default-model\n  config:\n    provider: mock\n    model: mock\n')

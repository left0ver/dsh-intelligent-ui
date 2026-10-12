import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compile } from '../src/dil/compile.ts'
import type { Command, Item, Report } from '../src/dil/protocol.ts'
import { createRuntime } from '../src/dil/runtime.ts'

/** 参考示例的源码。 */
const example = readFileSync(new URL('../src/dil/example.dil', import.meta.url), 'utf8')

/** 创建一个运行时。返回的函数发出一条指令，并得到指令执行后渲染出的界面树。 */
function runtime() {
  const reports: Report[] = []
  const receive = createRuntime(report => reports.push(report))
  return async (command: Command): Promise<Item[]> => {
    receive(command)
    // 重绘排在微任务里，等它执行完。
    await null
    const last = reports.at(-1)!
    assert.ok('tree' in last, JSON.stringify(last))
    return JSON.parse(last.tree)
  }
}

/** 找出第一个标签名为 `t` 的标签的路径；给了 `label` 时，它的 `label` 属性也要相符。 */
function locate(items: Item[], t: string, label?: string, path: number[] = []): number[] | undefined {
  for (const [index, item] of items.entries()) {
    if (typeof item === 'string') continue
    if (item.t === t && (label === undefined || item.p.label === label)) return [...path, index]
    const inner = locate(item.c, t, label, [...path, index])
    if (inner) return inner
  }
}

/** 构造一条指令：触发 `path` 处那个标签的 `onChange`。 */
const change = (path: number[], value: unknown): Command => ({ event: { path, name: 'onChange', args: [value] } })

test('the example paints its computed figures', async () => {
  const tree = await runtime()({ program: compile(example).program })
  assert.match(JSON.stringify(tree), /"Monthly payment","value":"¥4,490"/)
})

test('an event changes state and the figures follow', async () => {
  const send = runtime()
  const tree = await send({ program: compile(example).program })
  const after = await send(change(locate(tree, 'slider', 'Amount (10k)')!, 300))
  assert.match(JSON.stringify(after), /"value":"¥13,471"/)
})

test('blocks follow state', async () => {
  const send = runtime()
  const tree = await send({ program: compile(example).program })
  const after = await send(change(locate(tree, 'tabs')!, 'schedule'))
  assert.match(JSON.stringify(after), /After 30 years you have paid ¥1,616,561\./)
  assert.equal(locate(after, 'stat'), undefined)
})

test('every prefix of the example runs', async () => {
  const send = runtime()
  for (let length = 0; length <= example.length; length++) await send({ program: compile(example.slice(0, length)).program })
})

test('state survives the source growing', async () => {
  const send = runtime()
  const half = example.slice(0, example.indexOf('<tabs'))
  const tree = await send({ program: compile(half).program })
  await send(change(locate(tree, 'slider', 'Amount (10k)')!, 300))
  assert.match(JSON.stringify(await send({ program: compile(example).program })), /"value":"¥13,471"/)
})

test('every command is answered, whether or not it changes anything', async () => {
  const reports: Report[] = []
  const receive = createRuntime(report => reports.push(report))
  /** 发出一条指令，返回收到的回复条数。 */
  const answers = async (command: Command) => {
    receive(command)
    await null
    return reports.splice(0).length
  }
  assert.equal(await answers({ program: compile('<button onClick={() => { throw new Error("no") }}>go</button>').program }), 1)
  assert.equal(await answers({ event: { path: [0], name: 'onClick', args: [] } }), 1)
  assert.equal(await answers({ event: { path: [9], name: 'onClick', args: [] } }), 1)
  assert.equal(await answers({ program: 'return (' }), 1)
})

test('a failing expression costs only its own node', async () => {
  const tree = await runtime()({ program: compile('{@body const broken = missing.value}<text>{missing.value}</text><text>{1 + 1}</text>').program })
  assert.deepEqual(tree, [{ t: 'text', p: {}, c: [] }, { t: 'text', p: {}, c: ['2'] }])
})

test('a program may give its own variables any name', async () => {
  const tree = await runtime()({ program: compile('{@body const h = 1.7}{@body const $ = value => "$" + value}<text>{$(h)}</text>').program })
  assert.deepEqual(tree, [{ t: 'text', p: {}, c: ['$1.7'] }])
})

test('every declaration at the top of a statement reaches the ones after it', async () => {
  const source = [
    '{@body const low = []; const high = [] // both; let neither',
    'let total = 0}',
    '{@body for (let n = 1; n <= 4; n++) { const half = n / 2; total += n; (half > 1 ? high : low).push(() => n) }}',
    '<text>{total}: {low.map(read => read()).join("")} {high.map(read => read()).join("")}</text>',
  ].join('\n')
  assert.deepEqual(await runtime()({ program: compile(source).program }), [{ t: 'text', p: {}, c: ['10: 12 34'] }])
})

test('a statement may call a helper defined below it', async () => {
  const source = '{@body const rows = [1, 2].map(n => money(n))}{@body const count = rows.length}{@body const money = n => "$" + n}<text>{count}: {rows.join(" ")}</text>'
  assert.deepEqual(await runtime()({ program: compile(source).program }), [{ t: 'text', p: {}, c: ['2: $1 $2'] }])
})

test('a comment may hold quotes and braces', async () => {
  const source = [
    '{@body // the city\'s "local" time}',
    '{@body const double = n => {',
    '  // it\'s {n} twice',
    '  return n * 2 /* isn\'t { odd */',
    '}}',
    '{@body const base = 4 // don\'t change}',
    '<text>{double(base) // that\'s 8}</text>',
  ].join('\n')
  assert.deepEqual(await runtime()({ program: compile(source).program }), [{ t: 'text', p: {}, c: ['8'] }])
})

test('a regular expression may hold quotes and braces', async () => {
  const source = '{@body const words = text => text.match(/[a-z\']+|[{"]/g)}{@body const half = n => n / 2}<text>{words("it\'s {ok").join(" ")} {half(8) / 2}</text>'
  assert.deepEqual(await runtime()({ program: compile(source).program }), [{ t: 'text', p: {}, c: ['it\'s { ok 2'] }])
})

test('an {:else if} chain shows the first branch that holds', async () => {
  const source = [
    '{#each [3, 2, 1, 0] as n}',
    '<text>{#if n > 2}high{:else if n > 1}mid{:else if n > 0}low{:else}none{/if}</text>',
    '<text>{#if n > 2}high{:else if n > 1}mid{/if}</text>',
    '{/each}',
  ].join('')
  const tree = await runtime()({ program: compile(source).program })
  assert.deepEqual(tree.map(item => typeof item === 'string' ? item : item.c.join('')), ['high', 'high', 'mid', 'mid', 'low', '', 'none', ''])
})

test('a quoted attribute may embed expressions', async () => {
  const tree = await runtime()({ program: compile('{@body const years = 20}<stat label="After {years} years, `{years * 2}` \\ ${years}" hint="{ no"/>').program })
  assert.deepEqual(tree, [{ t: 'stat', p: { label: 'After 20 years, `40` \\ $20', hint: '{ no' }, c: [] }])
})

test('text inside elements reads HTML entities', async () => {
  const tree = await runtime()({ program: compile('<stat label="A &amp; B"/><text>under &lt;18.5 &unknown;</text>').program })
  assert.deepEqual(tree, [{ t: 'stat', p: { label: 'A & B' }, c: [] }, { t: 'text', p: {}, c: ['under <18.5 &unknown;'] }])
})

test('dollar amounts in prose are not read as math', () => {
  assert.deepEqual(compile('From $6,000 to $50,000, where $x$ is math.\n<text>$5</text>').prose, ['From \\$6,000 to \\$50,000, where $x$ is math.\n'])
})

test('only the source\'s own prose is Markdown; computed text stays text', async () => {
  const { program, prose } = compile('Read **this**.\n{"![](http://example.com/" + 1 + ")"}\n<text>inside</text>')
  assert.deepEqual(prose, ['Read **this**.\n'])
  assert.deepEqual(await runtime()({ program }), [
    { t: 'prose', p: { index: 0 }, c: [] },
    '![](http://example.com/1)',
    { t: 'text', p: {}, c: ['inside'] },
  ])
})

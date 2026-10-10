import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compile } from '../src/dil/compile.ts'
import type { Command, Item, Report } from '../src/dil/protocol.ts'
import { createRuntime } from '../src/dil/runtime.ts'

const example = readFileSync(new URL('../src/dil/example.dil', import.meta.url), 'utf8')

/** A runtime whose `send` resolves to the tree as painted after the command. */
function runtime() {
  const reports: Report[] = []
  const receive = createRuntime(report => reports.push(report))
  return async (command: Command): Promise<Item[]> => {
    receive(command)
    await null
    const last = reports.at(-1)!
    assert.ok('tree' in last, JSON.stringify(last))
    return JSON.parse(last.tree)
  }
}

/** Path of the first tag matching `t` and, when given, a `label` prop. */
function locate(items: Item[], t: string, label?: string, path: number[] = []): number[] | undefined {
  for (const [index, item] of items.entries()) {
    if (typeof item === 'string') continue
    if (item.t === t && (label === undefined || item.p.label === label)) return [...path, index]
    const inner = locate(item.c, t, label, [...path, index])
    if (inner) return inner
  }
}

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

test('a failing expression costs only its own node', async () => {
  const tree = await runtime()({ program: compile('{@body const broken = missing.value}<text>{missing.value}</text><text>{1 + 1}</text>').program })
  assert.deepEqual(tree, [{ t: 'text', p: {}, c: [] }, { t: 'text', p: {}, c: ['2'] }])
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

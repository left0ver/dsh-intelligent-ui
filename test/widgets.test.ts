import assert from 'node:assert/strict'
import { test } from 'node:test'
import { widgets } from '../src/client/widgets.ts'

/** 按会话引擎的方式，把会话事件依次累积成状态。 */
function fold(events: { type: string; data: object }[]) {
  let state: unknown
  for (const event of events) {
    const match = widgets.match(event as never)
    if (match?.role === 'start') state = widgets.start({} as never, { event } as never, {} as never)
    else if (match) state = widgets.update({ state } as never, { event } as never)
  }
  return state
}

/** 构造一次 `render_ui` 调用的事件，和它的工具结果事件。 */
const call = (callId: string) => ({ type: 'tool/call', data: { turn: 1, callId, name: 'render_ui', arguments: `{"title":"${callId}","source":""}` } })
const result = (toolCallId: string, isError: boolean) => ({ type: 'tool/result', data: { turn: 1, message: { toolCallId, isError } } })

test('a turn keeps the interfaces it showed and drops the ones turned down', () => {
  const events = [{ type: 'turn/start', data: { turn: 1 } }, call('a'), result('a', true), call('b'), result('b', false)]
  assert.deepEqual(fold(events), [{ callId: 'b', title: 'b', source: '' }])
})

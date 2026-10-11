/** 汇总每一轮对话生成的界面，放到回复下方的组件能读到的地方。 */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-session/types'
import { readArgs, TOOL, type UiArgs } from '../shared.ts'

/** 本插件的标识：每轮的数据、会话节点的类型和文案的命名空间都用它。 */
export const KEY = 'intelligent-ui'

/** 一个生成出来的界面，用写出它的那次工具调用来标识。 */
export interface Widget extends UiArgs {
  callId: string
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    /** 这一轮生成的界面，按调用顺序。 */
    'intelligent-ui': readonly Widget[]
  }
}

/** 把一轮对话里的 `render_ui` 调用累积成界面列表，并去掉失败的调用。 */
export const widgets: ConversationNodeDefinition<readonly Widget[]> = {
  kind: KEY,
  // 只关心三种事件：一轮开始、`render_ui` 调用、失败的工具结果。
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call' && event.data.name === TOOL) return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result' && event.data.message.isError) return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start: () => [],
  update: ({ state }, { event }) => {
    if (event.type === 'tool/call') return [...state, { callId: event.data.callId, ...readArgs(event.data.arguments) }]
    // 调用失败说明被宿主端打回了，模型会重写这个界面。
    if (event.type === 'tool/result') return state.filter(widget => widget.callId !== event.data.message.toolCallId)
    return state
  },
  // 有界面时，把列表挂到这一轮的数据上。
  buildLocationData: ({ id, state }, scope) => scope === 'turn' && state?.length
    ? { kind: 'turn', turn: Number(id), key: KEY, value: state }
    : null,
}

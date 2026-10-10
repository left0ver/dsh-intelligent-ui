/** The interfaces each Turn produced, published where the Turn tail can read them. */
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-session/types'
import { readArgs, TOOL, type UiArgs } from '../shared.ts'

/** Key of this plugin's Turn data and of its conversation contexts. */
export const KEY = 'intelligent-ui'

/** One generated interface, identified by the tool call that wrote it. */
export interface Widget extends UiArgs {
  callId: string
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    /** Interfaces generated during this Turn, in call order. */
    'intelligent-ui': readonly Widget[]
  }
}

/** Folds a Turn's `render_ui` calls into its list of widgets. */
export const widgets: ConversationNodeDefinition<readonly Widget[]> = {
  kind: KEY,
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call' && event.data.name === TOOL) return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start: () => [],
  update: ({ state }, { event }) => event.type === 'tool/call'
    ? [...state, { callId: event.data.callId, ...readArgs(event.data.arguments) }]
    : state,
  buildLocationData: ({ id, state }, scope) => scope === 'turn' && state?.length
    ? { kind: 'turn', turn: Number(id), key: KEY, value: state }
    : null,
}

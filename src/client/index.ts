/** Browser half: shows each `render_ui` call as an interface in the chat. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { TOOL } from '../shared.ts'
import { disposeSandboxes } from './sandbox.ts'
import { ToolRow, TurnTail } from './views.tsx'
import css from './widget.css'
import { KEY, widgets } from './widgets.ts'

export const inject = ['slots', 'uiConversation']

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    return () => {
      style.remove()
      disposeSandboxes()
    }
  })
  ctx.uiConversation.events.register(widgets)
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: TOOL }, ToolRow))
  ctx.slots.inject('conversation.chat.turnTail', () =>
    ctx.slots.register({ name: 'conversation.chat.turnTail', id: KEY }, TurnTail))
}

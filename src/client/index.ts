/** 浏览器端：把每次 `render_ui` 调用显示成对话里的一个界面。 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { TOOL } from '../shared.ts'
import { en, zh } from './locale.ts'
import { disposeSandboxes } from './sandbox.ts'
import { ToolRow, TurnTail } from './views.tsx'
import css from './widget.css'
import { KEY, widgets } from './widgets.ts'

/** 依赖的 dsh 服务。 */
export const inject = ['slots', 'uiConversation', 'locale']

export function apply(ctx: Context): void {
  // 插入样式；插件卸载时移除样式，并销毁所有沙箱。
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    return () => {
      style.remove()
      disposeSandboxes()
    }
  })
  // 注册本插件的文案。
  ctx.effect(() => ctx.locale.register(KEY, { zh, en }))
  // 从会话事件里汇总出每一轮生成的界面。
  ctx.uiConversation.events.register(widgets)
  // 生成过程中，界面显示在工具调用那一行。
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: TOOL, locale: KEY }, ToolRow))
  // 这一轮结束后，界面显示在回复下方。
  ctx.slots.inject('conversation.chat.turnTail', () =>
    ctx.slots.register({ name: 'conversation.chat.turnTail', id: KEY, locale: KEY }, TurnTail))
}

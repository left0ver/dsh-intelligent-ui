/** 界面显示的位置：生成过程中在工具调用那一行，这一轮结束后在回复下方。 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { compile } from '../dil/compile.ts'
import { readArgs } from '../shared.ts'
import type { Translate } from './locale.ts'
import { Fallback, Tree } from './render.tsx'
import { sandboxOf } from './sandbox.ts'
import { KEY, type Widget } from './widgets.ts'

/**
 * 一个界面：把源码编译后放进沙箱运行，再把结果画出来。
 * 两个显示位置共用同一个沙箱，所以界面换位置时状态不会丢。
 */
function WidgetView({ callId, title, source, t }: Widget & { t: Translate }) {
  const sandbox = useMemo(() => sandboxOf(callId), [callId])
  // 流式输出时源码每多一段，就重新编译并运行一次。
  const { program, prose } = useMemo(() => compile(source), [source])
  const { tree, error } = useSyncExternalStore(sandbox.subscribe, () => sandbox.shown)
  useEffect(() => sandbox.run(program), [sandbox, program])
  if (error) return <Fallback title={title} prose={prose} t={t} />
  // 还没画出任何东西时先显示标题。
  return tree.length
    ? <Tree items={tree} prose={prose} emit={sandbox.emit} t={t} />
    : <p className="iui-pending">{title}</p>
}

/** 工具调用行：调用结束前显示实时界面，结束后只显示标题，以及是否被打回。 */
export function ToolRow(props: ToolCallViewProps & PropsLocale<typeof KEY>) {
  const streaming = props.useToolCallArgumentsPartial()
  if (props.phase === 'result') {
    const { title } = readArgs(props.block.call?.argsRaw ?? '')
    return <span>{props.block.isError ? props.t('refused', { title }) : title}</span>
  }
  // 参数还在流式输出时读已经到达的部分，写完后读完整的参数。
  return <WidgetView callId={props.callId} t={props.t} {...readArgs(props.phase === 'preparing' ? streaming : props.block.argsRaw)} />
}

/** 回复下方：这一轮生成的所有界面。 */
export function TurnTail({ turn, t }: PropsRuntime<'conversation.chat.turnTail'> & PropsLocale<typeof KEY>) {
  return turn.data.get(KEY)?.map(widget => <WidgetView key={widget.callId} t={t} {...widget} />) ?? null
}

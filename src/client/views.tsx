/** Where an interface appears: in its tool row while written, below the reply once the Turn ends. */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { compile } from '../dil/compile.ts'
import { readArgs } from '../shared.ts'
import { Tree } from './render.tsx'
import { sandboxOf } from './sandbox.ts'
import { KEY, type Widget } from './widgets.ts'

/**
 * One interface: its source compiled and run in its sandbox, and the result
 * drawn. Both places share the sandbox, so state survives the move between them.
 */
function WidgetView({ callId, title, source }: Widget) {
  const sandbox = useMemo(() => sandboxOf(callId), [callId])
  const { program, prose } = useMemo(() => compile(source), [source])
  const tree = useSyncExternalStore(sandbox.subscribe, () => sandbox.tree)
  useEffect(() => sandbox.run(program), [sandbox, program])
  return tree.length
    ? <Tree items={tree} prose={prose} emit={sandbox.emit} />
    : <p className="iui-pending">{title}</p>
}

/** Tool row: the live interface until the call settles, then only its title. */
export function ToolRow(props: ToolCallViewProps) {
  const streaming = props.useToolCallArgumentsPartial()
  if (props.phase === 'result') return <span>{readArgs(props.block.call?.argsRaw ?? '').title}</span>
  return <WidgetView callId={props.callId} {...readArgs(props.phase === 'preparing' ? streaming : props.block.argsRaw)} />
}

/** Turn tail: every interface the finished Turn produced. */
export function TurnTail({ turn }: PropsRuntime<'conversation.chat.turnTail'>) {
  return turn.data.get(KEY)?.map(widget => <WidgetView key={widget.callId} {...widget} />) ?? null
}

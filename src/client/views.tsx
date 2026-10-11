/** Where an interface appears: in its tool row while written, below the reply once the Turn ends. */
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
 * One interface: its source compiled and run in its sandbox, and the result
 * drawn. Both places share the sandbox, so state survives the move between them.
 */
function WidgetView({ callId, title, source, t }: Widget & { t: Translate }) {
  const sandbox = useMemo(() => sandboxOf(callId), [callId])
  const { program, prose } = useMemo(() => compile(source), [source])
  const { tree, error } = useSyncExternalStore(sandbox.subscribe, () => sandbox.shown)
  useEffect(() => sandbox.run(program), [sandbox, program])
  if (error) return <Fallback title={title} prose={prose} t={t} />
  return tree.length
    ? <Tree items={tree} prose={prose} emit={sandbox.emit} t={t} />
    : <p className="iui-pending">{title}</p>
}

/** Tool row: the live interface until the call settles, then only its title and whether it was turned down. */
export function ToolRow(props: ToolCallViewProps & PropsLocale<typeof KEY>) {
  const streaming = props.useToolCallArgumentsPartial()
  if (props.phase === 'result') {
    const { title } = readArgs(props.block.call?.argsRaw ?? '')
    return <span>{props.block.isError ? props.t('refused', { title }) : title}</span>
  }
  return <WidgetView callId={props.callId} t={props.t} {...readArgs(props.phase === 'preparing' ? streaming : props.block.argsRaw)} />
}

/** Turn tail: every interface the finished Turn produced. */
export function TurnTail({ turn, t }: PropsRuntime<'conversation.chat.turnTail'> & PropsLocale<typeof KEY>) {
  return turn.data.get(KEY)?.map(widget => <WidgetView key={widget.callId} t={t} {...widget} />) ?? null
}

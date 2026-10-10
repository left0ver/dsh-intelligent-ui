/** Draws a painted tree with this page's own components. */
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Item, Tag } from '../dil/protocol.ts'
import { views } from './components.tsx'
import type { Sandbox } from './sandbox.ts'

type Emit = Sandbox['emit']

const LABELS = { code: { copyLabel: 'Copy', copiedLabel: 'Copied' }, footnotes: 'Footnotes' }

/**
 * The top level holds elements, places for the source's own prose, and text
 * the program computed. Only the prose is Markdown, read from `prose` rather
 * than from the tree: Markdown can load images, and a program must not be able
 * to send what it knows out through an image address.
 */
export function Tree({ items, prose, emit }: { items: Item[]; prose: string[]; emit: Emit }) {
  return (
    <div className="iui">
      {items.map((item, index) => typeof item === 'string'
        ? <p key={index} className="iui-text">{item}</p>
        : item.t === 'prose'
          ? <MarkdownText key={index} text={prose[Number(item.p.index)] ?? ''} labels={LABELS} />
          : <Part key={index} tag={item} path={[index]} emit={emit} />)}
    </div>
  )
}

function Part({ tag, path, emit }: { tag: Tag; path: number[]; emit: Emit }) {
  const View = Object.hasOwn(views, tag.t) ? views[tag.t as keyof typeof views] : views.box
  return (
    <View p={tag.p} on={(name, ...args) => emit(path, name, args)}>
      {tag.c.map((child, index) => typeof child === 'string'
        ? child
        : <Part key={index} tag={child} path={[...path, index]} emit={emit} />)}
    </View>
  )
}

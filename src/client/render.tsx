/** Draws a painted tree with this page's own components. */
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Item, Tag } from '../dil/protocol.ts'
import { views } from './components.tsx'
import type { Translate } from './locale.ts'
import type { Sandbox } from './sandbox.ts'

type Emit = Sandbox['emit']

/** What Markdown's own controls say, in the words dsh uses for them everywhere. */
const labels = (t: Translate) => ({ code: { copyLabel: t('copy'), copiedLabel: t('copied') }, footnotes: t('markdown.footnotes') })

/**
 * The top level holds elements, places for the source's own prose, and text
 * the program computed. Only the prose is Markdown, read from `prose` rather
 * than from the tree: Markdown can load images, and a program must not be able
 * to send what it knows out through an image address.
 */
export function Tree({ items, prose, emit, t }: { items: Item[]; prose: string[]; emit: Emit; t: Translate }) {
  return (
    <div className="iui">
      {items.map((item, index) => typeof item === 'string'
        ? <p key={index} className="iui-text">{item}</p>
        : item.t === 'prose'
          ? <MarkdownText key={index} text={prose[Number(item.p.index)] ?? ''} labels={labels(t)} />
          : <Part key={index} tag={item} path={[index]} emit={emit} />)}
    </div>
  )
}

/** What is left when the program cannot run: the source's own prose, and a word on what is missing. */
export function Fallback({ title, prose, t }: { title: string; prose: string[]; t: Translate }) {
  return (
    <div className="iui">
      <MarkdownText text={prose.join('\n\n')} labels={labels(t)} />
      <p className="iui-pending">{t('unshown', { title })}</p>
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

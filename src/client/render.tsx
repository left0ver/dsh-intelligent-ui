/** 用页面自己的组件，把沙箱报告的界面树画出来。 */
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Item, Tag } from '../dil/protocol.ts'
import { views } from './components.tsx'
import type { Translate } from './locale.ts'
import type { Sandbox } from './sandbox.ts'

/** 把事件发回沙箱的函数。 */
type Emit = Sandbox['emit']

/** Markdown 组件自带按钮上的文字，用 dsh 的公共词条。 */
const labels = (t: Translate) => ({ code: { copyLabel: t('copy'), copiedLabel: t('copied') }, footnotes: t('markdown.footnotes') })

/**
 * 整个界面。顶层有三种内容：元素、源码正文的占位，以及程序算出的文本。
 * 只有正文按 Markdown 渲染，而且原文取自 `prose` 而不是界面树：
 * Markdown 可以加载图片，不能让程序通过图片地址把它知道的数据送出去。
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

/** 程序无法运行时的显示：源码里的正文，加一句说明。 */
export function Fallback({ title, prose, t }: { title: string; prose: string[]; t: Translate }) {
  return (
    <div className="iui">
      <MarkdownText text={prose.join('\n\n')} labels={labels(t)} />
      <p className="iui-pending">{t('unshown', { title })}</p>
    </div>
  )
}

/** 递归渲染一个标签。`path` 是它在界面树里的位置，沙箱靠它找回对应的事件处理函数。 */
function Part({ tag, path, emit }: { tag: Tag; path: number[]; emit: Emit }) {
  // 不认识的标签按 `box` 渲染。
  const View = Object.hasOwn(views, tag.t) ? views[tag.t as keyof typeof views] : views.box
  return (
    <View p={tag.p} on={(name, ...args) => emit(path, name, args)}>
      {tag.c.map((child, index) => typeof child === 'string'
        ? child
        : <Part key={index} tag={child} path={[...path, index]} emit={emit} />)}
    </View>
  )
}

/**
 * DIL 的语法解析：Markdown 正文、`<tag>` 元素和 `{…}` 代码。
 *
 * 源码通常还在流式输出中。解析器只读到完整的部分，丢掉没写完的尾巴，
 * 没闭合的元素和块按“一直到末尾”处理，所以源码的任何前缀都能解析。
 * 途中放过的问题记在 `problems` 里，等源码写完后才有意义。
 */

/** 语法树节点：文本、`{表达式}`、元素、`{#if}` 块、`{#each}` 块。 */
export type Node =
  | { kind: 'text'; text: string }
  | { kind: 'code'; code: string }
  | { kind: 'element'; tag: string; props: Prop[]; children: Node[] }
  | { kind: 'if'; test: string; then: Node[]; otherwise: Node[] }
  | { kind: 'each'; list: string; item: string; children: Node[] }

/** 一个属性：字面文本，或每次渲染时求值的代码。 */
export type Prop = { name: string } & ({ text: string } | { code: string })

export interface Program {
  /** 各个 `{@body …}` 里的语句，按书写顺序。 */
  statements: string[]
  /** 顶层节点。 */
  nodes: Node[]
  /** 解析时放过的所有问题：没写完的片段，以及对不上的闭合标记。 */
  problems: string[]
}

/** 开始标签的 `<tag`。 */
const OPEN = /<([A-Za-z][\w.-]*)/y
/** 结束标签 `</tag>`。 */
const CLOSE = /<\/([\w.-]*)\s*>/y
/** 一个属性：`name`、`name="文本"`、`name='文本'`，或后面紧跟 `{代码}` 的 `name=`。 */
const ATTRIBUTE = /\s+([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(?={)))?/y
/** 开始标签的结尾：`>`，或自闭合的 `/>`。 */
const TAG_END = /\s*(\/?)>/y
/** 一段文本：到代码或标签为止；不是标签开头的 `<` 也算文本。 */
const TEXT = /(?:[^<{]|<(?![A-Za-z/]|$))+/y
/** `{…}` 里的指令及其后面的内容。 */
const DIRECTIVE = /^\s*(@body|#if|#each|:else|\/if|\/each)\b\s*([\s\S]*)$/
/** `{#each 列表 as 变量}` 里的列表和变量。 */
const EACH = /^([\s\S]+?)\s+as\s+([\s\S]+)$/
/** 带引号的属性值里嵌入的 `{表达式}`。 */
const EMBEDDED = /\{([^{}]+)\}/g

/** 带引号的属性值里嵌了 `{表达式}`（Svelte 的写法）时，把它转成模板字符串。 */
const template = (text: string) => `\`${text.replace(/[\`\\]|\$(?={)/g, '\\$&').replace(EMBEDDED, '${$1}')}\``

/** 解析源码。不会抛错：遇到的问题都记在返回值的 `problems` 里。 */
export function parse(source: string): Program {
  const statements: string[] = []
  const problems: string[] = []
  /** 当前读到的位置。 */
  let at = 0
  /** 刚读完的那个列表是被什么结束的（按原文）；读到输入末尾时为空。 */
  let ended = ''

  /** 问题描述里指代源码中某一段的写法：原文加行号。 */
  const mark = (piece: string, index: number) => `${piece} (line ${source.slice(0, index).split('\n').length})`
  /** 在当前位置匹配 `pattern`（须带 `y` 标志），匹配上就前进到它后面。 */
  const take = (pattern: RegExp) => {
    pattern.lastIndex = at
    const match = pattern.exec(source)
    if (match) at = pattern.lastIndex
    return match
  }
  /** 放弃没写完的尾巴，并记下是哪一段没写完、差在哪里。 */
  const giveUp = (piece: string, problem = 'is unfinished'): undefined => {
    problems.push(`${piece} ${problem}`)
    at = source.length
  }

  /** 读出当前位置那对 `{…}` 里面的内容。 */
  function braces(): string | undefined {
    const end = closing(source, at)
    if (end < 0) return giveUp(mark('{', at), 'has no closing }')
    const code = source.slice(at + 1, end)
    at = end + 1
    return code
  }

  /** 解析一个元素，此时它的 `<tag` 已经读过；`opener` 是问题描述里对它的称呼。 */
  function element(tag: string, opener: string): Node | undefined {
    const props: Prop[] = []
    for (let match; (match = take(ATTRIBUTE));) {
      const [, name, double, single] = match
      const text = double ?? single
      if (text !== undefined) props.push(text.search(EMBEDDED) < 0 ? { name, text } : { name, code: template(text) })
      // 只写了名字的属性等于 `true`。
      else if (source[at] !== '{') props.push({ name, code: 'true' })
      else {
        const code = braces()
        if (code === undefined) return
        props.push({ name, code })
      }
    }
    const end = take(TAG_END)
    if (!end) {
      /** 标签里读不下去的那一段；为空说明标签只是没写完。 */
      const rest = source.slice(at).trim().split('\n')[0].slice(0, 30)
      return giveUp(opener, rest ? `has a malformed attribute near \`${rest}\`: write name="text" or name={expression}` : undefined)
    }
    return { kind: 'element', tag, props, children: end[1] ? [] : list(opener, `</${tag}>`) }
  }

  /**
   * 读出 `opener` 里面的所有节点，直到遇到闭合标记。它应该由 `closers` 之一闭合，
   * 但任何闭合标记都会结束这个列表，对不上的记为问题。
   */
  function list(opener: string, ...closers: string[]): Node[] {
    const nodes: Node[] = []
    /** 结束这个列表的闭合标记。 */
    let closer = ''
    /** 当前这一项的起始位置，用来报告行号。 */
    let from = at
    while (!closer && at < source.length) {
      from = at
      let match
      if ((match = take(CLOSE))) closer = `</${match[1]}>`
      else if ((match = take(OPEN))) {
        const node = element(match[1], mark(`<${match[1]}>`, from))
        if (node) nodes.push(node)
      } else if (source[at] === '{') {
        const code = braces()
        if (code === undefined) break
        const [, directive, rest = ''] = DIRECTIVE.exec(code) ?? []
        if (directive === '@body') statements.push(rest)
        else if (directive === '#if') {
          const block = mark('{#if}', from)
          // 第一段如果是被 `{:else}` 结束的，后面还有第二段。
          nodes.push({ kind: 'if', test: rest, then: list(block, '{:else}', '{/if}'), otherwise: ended === '{:else}' ? list(block, '{/if}') : [] })
        } else if (directive === '#each') {
          const [, items = rest, item = 'item'] = EACH.exec(rest) ?? []
          nodes.push({ kind: 'each', list: items, item, children: list(mark('{#each}', from), '{/each}') })
        } else if (directive) closer = `{${directive}}`
        else nodes.push({ kind: 'code', code })
      } else if ((match = take(TEXT))) nodes.push({ kind: 'text', text: match[0] })
      else giveUp(mark('<', at))
    }
    if (!closers.includes(closer)) {
      problems.push(closer
        ? `${mark(closer, from)} ${opener ? `does not close ${opener}` : 'closes nothing'}`
        : `${opener} is never closed`)
    }
    ended = closer
    return nodes
  }

  const nodes: Node[] = []
  // 顶层没有需要闭合的东西：多余的闭合标记记为问题，然后接着往下读。
  while (at < source.length) nodes.push(...list('', ''))
  return { statements, nodes, problems }
}

/**
 * 代码里要认的记号：花括号、行注释的开头、块注释、字符串、正则。
 * 最后一项是正则，连同它前面的那个符号：`/` 跟在这些符号后面时是正则的开头，否则是除号。
 * 整个认出来之后，正则里的引号和花括号就不会被当成字符串和代码块。
 */
const CODE = /[{}]|\/\/|\/\*[\s\S]*?(?:\*\/|$)|"(?:[^"\\]|\\[^])*"?|'(?:[^'\\]|\\[^])*'?|`(?:[^`\\]|\\[^])*`?|(?:[(,=:[!&|?;>]|\breturn)\s*\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\//g
/** 行注释里要认的记号：花括号和行尾。引号在这里只是普通字符，不是字符串的开头。 */
const COMMENT = /[{}\n]/g

/**
 * 与 `open` 处的 `{` 配对的 `}` 的位置；代码还没写完时返回 -1。字符串、块注释和正则里的花括号不算。
 * 行注释里的花括号照常计数：`{@body … // 说明}` 就是靠注释后面那个 `}` 闭合的。
 */
function closing(source: string, open: number): number {
  /** 当前要认的记号：进了行注释就换成 `COMMENT`，到行尾再换回来。 */
  let tokens = CODE
  for (let depth = 0, at = open; ;) {
    tokens.lastIndex = at
    const [token] = tokens.exec(source) ?? []
    if (token === undefined) return -1
    at = tokens.lastIndex
    if (token === '{') depth++
    else if (token !== '}') tokens = token === '//' ? COMMENT : CODE
    else if (--depth === 0) return at - 1
  }
}

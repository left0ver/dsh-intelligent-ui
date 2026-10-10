/**
 * DIL syntax: Markdown prose, `<tag>` elements, and `{…}` code.
 *
 * The source is usually still being written. The parser reads as far as the
 * input is complete, drops an unfinished tail, and leaves open elements and
 * blocks open-ended, so every prefix of a document parses.
 */

export type Node =
  | { kind: 'text'; text: string }
  | { kind: 'code'; code: string }
  | { kind: 'element'; tag: string; props: Prop[]; children: Node[] }
  | { kind: 'if'; test: string; then: Node[]; otherwise: Node[] }
  | { kind: 'each'; list: string; item: string; children: Node[] }

/** One attribute: literal text, or code evaluated on every render. */
export type Prop = { name: string } & ({ text: string } | { code: string })

export interface Program {
  /** `{@body …}` statements, in source order. */
  statements: string[]
  nodes: Node[]
}

const OPEN = /<([A-Za-z][\w.-]*)/y
const CLOSE = /<\/[\w.-]*\s*>/y
const ATTRIBUTE = /\s+([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(?={)))?/y
const TAG_END = /\s*(\/?)>/y
/** Anything up to code or a tag; a `<` that starts no tag is text. */
const TEXT = /(?:[^<{]|<(?![A-Za-z/]|$))+/y
const DIRECTIVE = /^\s*(@body|#if|#each|:else|\/if|\/each)\b\s*([\s\S]*)$/
const EACH = /^([\s\S]+?)\s+as\s+([\s\S]+)$/

export function parse(source: string): Program {
  const statements: string[] = []
  let at = 0
  /** What ended the innermost list: a closing tag or directive, or nothing at the end of input. */
  let ended = ''

  const take = (pattern: RegExp) => {
    pattern.lastIndex = at
    const match = pattern.exec(source)
    if (match) at = pattern.lastIndex
    return match
  }
  /** Abandon an unfinished tail. */
  const giveUp = (): undefined => { at = source.length }

  /** The inside of the `{…}` at the cursor. */
  function braces(): string | undefined {
    const end = closing(source, at)
    if (end < 0) return giveUp()
    const code = source.slice(at + 1, end)
    at = end + 1
    return code
  }

  function element(tag: string): Node | undefined {
    const props: Prop[] = []
    for (let match; (match = take(ATTRIBUTE));) {
      const [, name, double, single] = match
      const text = double ?? single
      if (text !== undefined) props.push({ name, text })
      else if (source[at] !== '{') props.push({ name, code: 'true' })
      else {
        const code = braces()
        if (code === undefined) return
        props.push({ name, code })
      }
    }
    const end = take(TAG_END)
    if (!end) return giveUp()
    return { kind: 'element', tag, props, children: end[1] ? [] : list() }
  }

  function list(): Node[] {
    const nodes: Node[] = []
    while (at < source.length) {
      let match
      if (take(CLOSE)) return (ended = '</', nodes)
      if ((match = take(OPEN))) {
        const node = element(match[1])
        if (node) nodes.push(node)
      } else if (source[at] === '{') {
        const code = braces()
        if (code === undefined) break
        const [, mark, rest = ''] = DIRECTIVE.exec(code) ?? []
        if (mark === '@body') statements.push(rest)
        else if (mark === '#if') nodes.push({ kind: 'if', test: rest, then: list(), otherwise: ended === ':else' ? list() : [] })
        else if (mark === '#each') {
          const [, items = rest, item = 'item'] = EACH.exec(rest) ?? []
          nodes.push({ kind: 'each', list: items, item, children: list() })
        } else if (mark) return (ended = mark, nodes)
        else nodes.push({ kind: 'code', code })
      } else if ((match = take(TEXT))) nodes.push({ kind: 'text', text: match[0] })
      else giveUp()
    }
    ended = ''
    return nodes
  }

  const nodes: Node[] = []
  while (at < source.length) nodes.push(...list())
  return { statements, nodes }
}

/** Index of the brace closing the one at `open`, or -1 while the code is unfinished. Braces in strings do not count. */
function closing(source: string, open: number): number {
  const token = /[{}]|"(?:[^"\\]|\\[^])*"?|'(?:[^'\\]|\\[^])*'?|`(?:[^`\\]|\\[^])*`?/g
  token.lastIndex = open
  for (let depth = 0, match; (match = token.exec(source));) {
    if (match[0] === '{') depth++
    else if (match[0] === '}' && --depth === 0) return match.index
  }
  return -1
}

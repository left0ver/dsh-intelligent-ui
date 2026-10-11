/**
 * DIL syntax: Markdown prose, `<tag>` elements, and `{…}` code.
 *
 * The source is usually still being written. The parser reads as far as the
 * input is complete, drops an unfinished tail, and leaves open elements and
 * blocks open-ended, so every prefix of a document parses. What it let pass on
 * the way is listed as `problems`, which matter once the source is finished.
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
  /** Everything the parser let pass: unfinished pieces, and closers that close the wrong thing. */
  problems: string[]
}

const OPEN = /<([A-Za-z][\w.-]*)/y
const CLOSE = /<\/([\w.-]*)\s*>/y
const ATTRIBUTE = /\s+([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(?={)))?/y
const TAG_END = /\s*(\/?)>/y
/** Anything up to code or a tag; a `<` that starts no tag is text. */
const TEXT = /(?:[^<{]|<(?![A-Za-z/]|$))+/y
const DIRECTIVE = /^\s*(@body|#if|#each|:else|\/if|\/each)\b\s*([\s\S]*)$/
const EACH = /^([\s\S]+?)\s+as\s+([\s\S]+)$/
const EMBEDDED = /\{([^{}]+)\}/g

/** A quoted attribute that embeds `{expression}`, as Svelte allows, read as a template string. */
const template = (text: string) => `\`${text.replace(/[\`\\]|\$(?={)/g, '\\$&').replace(EMBEDDED, '${$1}')}\``

export function parse(source: string): Program {
  const statements: string[] = []
  const problems: string[] = []
  let at = 0
  /** What closed the innermost list, as written; nothing at the end of input. */
  let ended = ''

  /** A piece of the source as problems name it. */
  const mark = (piece: string, index: number) => `${piece} (line ${source.slice(0, index).split('\n').length})`
  const take = (pattern: RegExp) => {
    pattern.lastIndex = at
    const match = pattern.exec(source)
    if (match) at = pattern.lastIndex
    return match
  }
  /** Abandon an unfinished tail. */
  const giveUp = (piece: string): undefined => {
    problems.push(`${piece} is unfinished`)
    at = source.length
  }

  /** The inside of the `{…}` at the cursor. */
  function braces(): string | undefined {
    const end = closing(source, at)
    if (end < 0) return giveUp(mark('{', at))
    const code = source.slice(at + 1, end)
    at = end + 1
    return code
  }

  /** The element whose `<tag` was just read; `opener` names it in problems. */
  function element(tag: string, opener: string): Node | undefined {
    const props: Prop[] = []
    for (let match; (match = take(ATTRIBUTE));) {
      const [, name, double, single] = match
      const text = double ?? single
      if (text !== undefined) props.push(text.search(EMBEDDED) < 0 ? { name, text } : { name, code: template(text) })
      else if (source[at] !== '{') props.push({ name, code: 'true' })
      else {
        const code = braces()
        if (code === undefined) return
        props.push({ name, code })
      }
    }
    const end = take(TAG_END)
    if (!end) return giveUp(opener)
    return { kind: 'element', tag, props, children: end[1] ? [] : list(opener, `</${tag}>`) }
  }

  /** The nodes up to whatever closes `opener`; one of `closers` should. Any closer ends the list. */
  function list(opener: string, ...closers: string[]): Node[] {
    const nodes: Node[] = []
    let closer = ''
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
  while (at < source.length) nodes.push(...list('', ''))
  return { statements, nodes, problems }
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

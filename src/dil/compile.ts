/**
 * Turns DIL source into the body of a render function `(DIL, h, $) => Item[]`.
 *
 * The function runs again on every change, so derived values are plain
 * expressions. Failures stay local: a statement runs in its own `try`, and
 * every embedded expression goes through `$`, which yields nothing if it throws.
 */
import { parse, type Node, type Prop } from './parse.ts'

export interface Compiled {
  program: string
  /**
   * The prose written outside any element. The program only says where each
   * piece goes, by index: the host draws it as Markdown from this table, so
   * nothing a program computes is ever read as Markdown.
   */
  prose: string[]
}

/** `const [name, setName] = DIL.useState(initial)`: the state is kept under its variable name. */
const STATE = /^(\s*\w+\s*\[\s*([\w$]+)[^\]]*\]\s*=\s*DIL\.useState\()([\s\S]*)\)\s*;?\s*$/

const text = JSON.stringify
const guard = (code: string) => `$(() => (${code}\n))`
const prop = (prop: Prop) => `${text(prop.name)}: ${'code' in prop ? guard(prop.code) : text(prop.text)}`

/** `var` lets a declaration made inside its own `try` reach the statements after it. */
const statement = (code: string) => `try { ${code
  .replace(STATE, (_, head, name, initial) => `${head}${initial.trim() || 'undefined'}, ${text(name)})`)
  .replace(/^\s*(?:const|let)\b/, 'var')}\n} catch {}`

export function compile(source: string): Compiled {
  const { statements, nodes } = parse(source)
  const prose: string[] = []

  /** `top` holds until the first enclosing element. */
  const list = (nodes: Node[], top: boolean): string => `[${nodes.map(node => emit(node, top)).filter(Boolean).join(', ')}]`

  function emit(node: Node, top: boolean): string {
    switch (node.kind) {
      case 'text':
        if (!top) return text(node.text)
        return node.text.trim() && `h("prose", {index: ${prose.push(node.text) - 1}})`
      case 'code': return guard(node.code)
      case 'element': return `h(${text(node.tag)}, {${node.props.map(prop).join(', ')}}, ${list(node.children, false)})`
      case 'if': return `(${guard(node.test)} ? ${list(node.then, top)} : ${list(node.otherwise, top)})`
      case 'each': return guard(`(${node.list}).map((${node.item}) => ${list(node.children, top)})`)
    }
  }

  return { program: `${statements.map(statement).join('\n')}\nreturn ${list(nodes, true)}`, prose }
}

/**
 * Turns DIL source into the body of a render function `(DIL, $h, $$) => Item[]`.
 *
 * The function runs again on every change, so derived values are plain
 * expressions. Failures stay local, and all of them end up in `$$`: every
 * embedded expression is evaluated by it and yields nothing if it throws, and
 * a statement runs in its own `try` that hands over what it caught.
 *
 * A statement that throws gets a second run after all the others: models put
 * helpers below the statements calling them, as hoisting would let them.
 */
import { parse, type Node, type Prop } from './parse.ts'
import { PARAMETERS } from './protocol.ts'

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

const [, TAG, GUARD] = PARAMETERS
const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: '\'', nbsp: '\u00a0' }
const text = JSON.stringify
/** Text inside elements is written as in HTML, where models escape what could pass for a tag. */
const literal = (value: string) => text(value.replace(/&(\w+);/g, (entity, name) => ENTITIES[name] ?? entity))
const guard = (code: string) => `${GUARD}(() => (${code}\n))`
const prop = (prop: Prop) => `${text(prop.name)}: ${'code' in prop ? guard(prop.code) : literal(prop.text)}`

/** Comments, strings and brackets, which decide whether a `const` or `let` opening a statement is at the top level. */
const DECLARATION = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|`(?:[^`\\]|\\[^])*`|[{([\])}]|(^|[;\n])(\s*)(?:const|let)\b/g

/**
 * Make every top-level declaration a `var`: it then outlives the `try` its
 * statement runs in, and the statements after it can see it. Declarations
 * inside blocks and functions keep their own scope.
 */
function hoist(code: string): string {
  let depth = 0
  return code.replace(DECLARATION, (token, before?: string, space?: string) => {
    if (before !== undefined) return depth ? token : `${before}${space}var`
    if ('{(['.includes(token)) depth++
    else if ('])}'.includes(token)) depth--
    return token
  })
}

/** Each statement in its own `try`, then once more the ones that threw. */
function run(statements: string[]): string {
  const bodies = statements.map(code => hoist(code
    .replace(STATE, (_, head, name, initial) => `${head}${initial.trim() || 'undefined'}, ${text(name)})`)))
  return [
    ...bodies.map((body, index) => `try { ${body}\n} catch { var ${GUARD}${index} = true }`),
    ...bodies.map((body, index) => `if (${GUARD}${index}) try { ${body}\n} catch (error) { ${GUARD}(() => { throw error }) }`),
  ].join('\n')
}

export function compile(source: string): Compiled {
  const { statements, nodes } = parse(source)
  const prose: string[] = []

  /** `top` holds until the first enclosing element. */
  const list = (nodes: Node[], top: boolean): string => `[${nodes.map(node => emit(node, top)).filter(Boolean).join(', ')}]`

  function emit(node: Node, top: boolean): string {
    switch (node.kind) {
      case 'text':
        if (!top) return literal(node.text)
        return node.text.trim() && `${TAG}("prose", {index: ${prose.push(node.text) - 1}})`
      case 'code': return guard(node.code)
      case 'element': return `${TAG}(${text(node.tag)}, {${node.props.map(prop).join(', ')}}, ${list(node.children, false)})`
      case 'if': return `(${guard(node.test)} ? ${list(node.then, top)} : ${list(node.otherwise, top)})`
      case 'each': return guard(`(${node.list}).map((${node.item}) => ${list(node.children, top)})`)
    }
  }

  return { program: `${run(statements)}\nreturn ${list(nodes, true)}`, prose }
}

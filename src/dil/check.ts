/**
 * What is wrong with a finished source, in words its author can act on.
 * Code is only parsed here, never run: running it is the sandbox's job.
 */
import { parse, type Node } from './parse.ts'
import { VOCABULARY } from './vocabulary.ts'

export function check(source: string): string[] {
  const { statements, nodes, problems } = parse(source)

  /** `code` must parse as a function body; `written` is how the source put it. */
  const syntax = (written: string, code: string) => {
    try {
      new Function(code)
    } catch (error) {
      problems.push(`${written}: ${(error as Error).message}`)
    }
  }
  const expression = (code: string) => syntax(`{${code}}`, `return (${code}\n)`)

  function visit(nodes: Node[]): void {
    for (const node of nodes) {
      if (node.kind === 'code') expression(node.code)
      else if (node.kind === 'if') expression(node.test)
      else if (node.kind === 'each') syntax(`{#each ${node.list} as ${node.item}}`, `(${node.list}).map((${node.item}) => 0)`)
      else if (node.kind === 'element') {
        if (!Object.hasOwn(VOCABULARY, node.tag)) problems.push(`<${node.tag}> is not an element`)
        for (const prop of node.props) if ('code' in prop) expression(prop.code)
      }
      if ('children' in node) visit(node.children)
      if (node.kind === 'if') visit([...node.then, ...node.otherwise])
    }
  }

  for (const statement of statements) syntax(`{@body ${statement}}`, statement)
  visit(nodes)
  return problems
}

/**
 * 检查一份写完的源码有什么问题，结果是模型看了就能照着改的文字。
 * 这里只解析代码，绝不执行：执行是沙箱的事。
 */
import { parse, type Node } from './parse.ts'
import { VOCABULARY } from './vocabulary.ts'

/** 返回源码里的所有问题，没有问题时是空数组。 */
export function check(source: string): string[] {
  const { statements, nodes, problems } = parse(source)

  /** `code` 必须能作为函数体通过解析；`written` 是它在源码里的写法，用于报告。 */
  const syntax = (written: string, code: string) => {
    try {
      new Function(code)
    } catch (error) {
      problems.push(`${written}: ${(error as Error).message}`)
    }
  }
  /** 检查一个表达式的语法。 */
  const expression = (code: string) => syntax(`{${code}}`, `return (${code}\n)`)

  /** 逐个检查节点：其中代码的语法，以及元素是否在允许的范围内。 */
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

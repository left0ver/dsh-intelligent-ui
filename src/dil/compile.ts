/**
 * 把 DIL 源码编译成渲染函数 `(DIL, $h, $$) => Item[]` 的函数体。
 *
 * 每次状态变化都会重新执行这个函数，所以派生值写成普通表达式就行。
 * 出错只影响局部，而且都交给 `$$` 处理：每个嵌入的表达式都由它求值，
 * 抛错时得到空值；每条语句放在自己的 `try` 里，捕获到的错误也交给它。
 *
 * 抛错的语句会在其他语句都执行完后再执行一次：模型常把辅助函数写在
 * 调用它的语句下面，就像函数声明会被提升那样。
 */
import { parse, type Node, type Prop } from './parse.ts'
import { PARAMETERS } from './protocol.ts'

export interface Compiled {
  /** 渲染函数的函数体。 */
  program: string
  /**
   * 写在元素之外的正文。程序里只按下标记录每段放在哪里，页面再从这张表里
   * 取出原文按 Markdown 渲染，这样程序算出来的内容永远不会被当成 Markdown。
   */
  prose: string[]
}

/** 匹配 `const [name, setName] = DIL.useState(initial)`：状态按变量名保存。 */
const STATE = /^(\s*\w+\s*\[\s*([\w$]+)[^\]]*\]\s*=\s*DIL\.useState\()([\s\S]*)\)\s*;?\s*$/

/** 生成的代码里用到的两个内部名字：创建标签的函数，和保护求值的函数。 */
const [, TAG, GUARD] = PARAMETERS
/** 能还原的 HTML 实体。 */
const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: '\'', nbsp: '\u00a0' }
/** 把值写成 JavaScript 字面量。 */
const text = JSON.stringify
/** 元素里的字面文本按 HTML 的写法处理：模型会把可能被当成标签的字符写成实体，这里还原回来。 */
const literal = (value: string) => text(value.replace(/&(\w+);/g, (entity, name) => ENTITIES[name] ?? entity))
/** 把一段代码包进保护函数：抛错时只是没有值，不影响别处。 */
const guard = (code: string) => `${GUARD}(() => (${code}\n))`
/** 一个属性在生成的对象字面量里的写法。 */
const prop = (prop: Prop) => `${text(prop.name)}: ${'code' in prop ? guard(prop.code) : literal(prop.text)}`

/** 匹配注释、字符串和括号，用来判断语句开头的 `const` / `let` 是否处于顶层。 */
const DECLARATION = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|`(?:[^`\\]|\\[^])*`|[{([\])}]|(^|[;\n])(\s*)(?:const|let)\b/g

/**
 * 把顶层的声明都改成 `var`：这样它就不受所在语句那个 `try` 块的限制，
 * 后面的语句也能访问到。块和函数内部的声明保持原来的作用域。
 */
function hoist(code: string): string {
  /** 当前所在的括号层数，0 表示顶层。 */
  let depth = 0
  return code.replace(DECLARATION, (token, before?: string, space?: string) => {
    if (before !== undefined) return depth ? token : `${before}${space}var`
    if ('{(['.includes(token)) depth++
    else if ('])}'.includes(token)) depth--
    return token
  })
}

/** 生成执行语句的代码：每条语句放在各自的 `try` 里，抛错的最后再执行一次。 */
function run(statements: string[]): string {
  // 给 `DIL.useState(…)` 补上变量名作为第二个参数，运行时用它作状态的键。
  const bodies = statements.map(code => hoist(code
    .replace(STATE, (_, head, name, initial) => `${head}${initial.trim() || 'undefined'}, ${text(name)})`)))
  return [
    // 第一遍：抛错的语句只记下一个标记。
    ...bodies.map((body, index) => `try { ${body}\n} catch { var ${GUARD}${index} = true }`),
    // 第二遍：重新执行有标记的语句，还抛错就把错误交给保护函数。
    ...bodies.map((body, index) => `if (${GUARD}${index}) try { ${body}\n} catch (error) { ${GUARD}(() => { throw error }) }`),
  ].join('\n')
}

/** 编译源码。源码没写完时也能编译，得到的是已写完部分的界面。 */
export function compile(source: string): Compiled {
  const { statements, nodes } = parse(source)
  const prose: string[] = []

  /** 生成一组节点的代码。`top` 表示还在顶层，进入第一个元素后就不再是。 */
  const list = (nodes: Node[], top: boolean): string => `[${nodes.map(node => emit(node, top)).filter(Boolean).join(', ')}]`

  /** 生成一个节点的代码。 */
  function emit(node: Node, top: boolean): string {
    switch (node.kind) {
      case 'text':
        if (!top) return literal(node.text)
        // 顶层的文本是正文：存进 `prose`，程序里只留一个带下标的占位标签。
        // 金额前的 `$` 加上反斜杠，否则 Markdown 会把两个金额之间的文字当成数学公式。
        return node.text.trim() && `${TAG}("prose", {index: ${prose.push(node.text.replace(/\$(?=\d)/g, '\\$')) - 1}})`
      case 'code': return guard(node.code)
      case 'element': return `${TAG}(${text(node.tag)}, {${node.props.map(prop).join(', ')}}, ${list(node.children, false)})`
      case 'if': return `(${guard(node.test)} ? ${list(node.then, top)} : ${list(node.otherwise, top)})`
      case 'each': return guard(`(${node.list}).map((${node.item}) => ${list(node.children, top)})`)
    }
  }

  return { program: `${run(statements)}\nreturn ${list(nodes, true)}`, prose }
}

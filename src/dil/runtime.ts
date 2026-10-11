/**
 * 运行编译后的程序：保存状态、调用事件处理函数、报告渲染结果。
 * 每条指令都恰好回复一次，发送方据此区分程序是执行完了还是卡死了。
 */
import { PARAMETERS, type Command, type Item, type Report, type Tag } from './protocol.ts'

/** 创建一个运行时：`report` 用来把结果发出去，返回的函数用来接收指令。 */
export function createRuntime(report: (report: Report) => void): (command: Command) => void {
  /** 状态，按名字保存；换一段程序后，同名的状态保留原值。 */
  const state = new Map<string, unknown>()
  /** 当前程序的渲染函数。 */
  let render: () => unknown = () => []
  /** 最近一次渲染出的界面树；事件按路径在里面找处理函数。 */
  let tree: Item[] = []
  /** 是否已经安排了一次重绘。 */
  let queued = false
  /** 一次渲染中没有名字的状态的个数，用来给它们编号。 */
  let unnamed = 0

  /** 程序里的 `DIL`：状态 API。 */
  const DIL = {
    // 和 React 一样：初始值和新值都可以是函数。`key` 由编译器填成变量名。
    useState(initial: unknown, key = `#${unnamed++}`) {
      if (!state.has(key)) state.set(key, typeof initial === 'function' ? initial() : initial)
      return [state.get(key), (next: unknown) => {
        state.set(key, typeof next === 'function' ? next(state.get(key)) : next)
        repaint()
      }]
    },
  }
  /** 程序里的 `$h`：创建一个标签。 */
  const h = (t: string, p: Tag['p'], ...c: unknown[]): Tag => ({ t, p, c: content(c) })
  /** 程序里的 `$$`：求值，抛错时得到 `undefined`。 */
  const $ = (evaluate: () => unknown) => {
    try { return evaluate() } catch { return undefined }
  }

  /** 等当前这轮工作结束后重绘一次，不管其间改了多少个状态。 */
  function repaint() {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      unnamed = 0
      try {
        tree = content([render()])
        // 函数传不出沙箱，事件处理函数用 `true` 占位。
        report({ tree: JSON.stringify(tree, (_, value) => typeof value === 'function' ? true : value) })
      } catch (error) {
        report({ error: String(error) })
      }
    })
  }

  return (command) => {
    if ('program' in command) {
      // 换成新程序；语法有错时无法生成函数，直接报告错误。
      try {
        render = new Function(...PARAMETERS, command.program).bind(undefined, DIL, h, $)
      } catch (error) {
        return report({ error: String(error) })
      }
      repaint()
    } else {
      const { path, name, args } = command.event
      // 沿着路径在界面树里找到标签，再调用它的处理函数。
      const target = path.reduce<Item | undefined>((tag, index) => typeof tag === 'object' ? tag.c[index] : undefined, { t: '', p: {}, c: tree })
      const handler = typeof target === 'object' ? target.p[name] : undefined
      if (typeof handler === 'function') $(() => handler(...args))
      // 即使什么都没变也重绘，保证每条指令都有回复。
      repaint()
    }
  }
}

/** 整理子项：展平嵌套的数组，只留文本和标签，相邻的文本合并成一段。 */
function content(children: unknown[]): Item[] {
  const items: Item[] = []
  for (const child of children.flat(Infinity)) {
    if (typeof child === 'object' && child !== null && 't' in child) items.push(child as Tag)
    else if (typeof child !== 'string' && typeof child !== 'number') continue
    else if (typeof items.at(-1) === 'string') items[items.length - 1] += String(child)
    else items.push(String(child))
  }
  return items
}

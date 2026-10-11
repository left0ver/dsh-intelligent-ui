/**
 * Runs compiled programs: keeps their state, calls their handlers, reports
 * what they paint. Every command is answered with one report, so whoever sent
 * it can tell a program that is done from one that hangs.
 */
import { PARAMETERS, type Command, type Item, type Report, type Tag } from './protocol.ts'

export function createRuntime(report: (report: Report) => void): (command: Command) => void {
  const state = new Map<string, unknown>()
  let render: () => unknown = () => []
  let tree: Item[] = []
  let queued = false
  /** Counts the states of one render that carry no name. */
  let unnamed = 0

  const DIL = {
    useState(initial: unknown, key = `#${unnamed++}`) {
      if (!state.has(key)) state.set(key, typeof initial === 'function' ? initial() : initial)
      return [state.get(key), (next: unknown) => {
        state.set(key, typeof next === 'function' ? next(state.get(key)) : next)
        repaint()
      }]
    },
  }
  const h = (t: string, p: Tag['p'], ...c: unknown[]): Tag => ({ t, p, c: content(c) })
  const $ = (evaluate: () => unknown) => {
    try { return evaluate() } catch { return undefined }
  }

  /** Paint once after the current work, however many states it changed. */
  function repaint() {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      unnamed = 0
      try {
        tree = content([render()])
        report({ tree: JSON.stringify(tree, (_, value) => typeof value === 'function' ? true : value) })
      } catch (error) {
        report({ error: String(error) })
      }
    })
  }

  return (command) => {
    if ('program' in command) {
      try {
        render = new Function(...PARAMETERS, command.program).bind(undefined, DIL, h, $)
      } catch (error) {
        return report({ error: String(error) })
      }
      repaint()
    } else {
      const { path, name, args } = command.event
      const target = path.reduce<Item | undefined>((tag, index) => typeof tag === 'object' ? tag.c[index] : undefined, { t: '', p: {}, c: tree })
      const handler = typeof target === 'object' ? target.p[name] : undefined
      if (typeof handler === 'function') $(() => handler(...args))
      repaint()
    }
  }
}

/** Flatten children, keep only text and tags, and join neighbouring text. */
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

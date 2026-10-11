/**
 * 模型写的程序在这里运行：一个 iframe 里的 Worker。iframe 没有源、不能联网，
 * 把程序和本页面的数据、所有服务器隔开；Worker 让程序碰不到 DOM，也不占用主线程。
 * 程序唯一能做的事，是发回一棵描述界面的树。
 */
import type { Command, Item, Report } from '../dil/protocol.ts'

/**
 * iframe 的完整文档：启动 Worker，并在两边之间转发消息。
 * 其中的 CSP 禁止一切网络请求，只放行这段内联脚本和 blob 形式的 Worker。
 */
const RUNNER = `<!doctype html>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:">
<script>
  const worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(__WORKER__).replace(/</g, '\\u003c')}])))
  worker.onmessage = event => parent.postMessage(event.data, '*')
  onmessage = event => event.source === parent && worker.postMessage(event.data)
</script>`

/** 只保留能渲染的内容：程序可能发来任何东西。 */
const items = (value: unknown): Item[] => (Array.isArray(value) ? value : []).flatMap((item): Item[] => {
  if (typeof item === 'string') return [item]
  if (typeof item?.t !== 'string') return []
  return [{ t: item.t, p: typeof item.p === 'object' && item.p !== null ? item.p : {}, c: items(item.c) }]
})

/** 一条指令多久得不到回复，就认为程序卡死了。 */
const TIMEOUT_MS = 2000

/** 沙箱当前要显示的内容：程序最近一次渲染出的界面树，或者没有界面的原因。 */
export interface Shown {
  tree: Item[]
  error?: string
}

/** 一个界面对应的沙箱。 */
export class Sandbox {
  shown: Shown = { tree: [] }
  /** 承载 Worker 的 iframe，第一次运行程序时才创建。 */
  private frame?: HTMLIFrameElement
  /** 订阅了显示内容变化的回调。 */
  private watchers = new Set<() => void>()
  /** 当前运行的程序。 */
  private program = ''
  /** Worker 是否已经就绪，可以接收指令。 */
  private ready = false
  /** 还没得到回复的指令数。 */
  private owed = 0
  /** 超时计时器，从最早那条没回复的指令算起。 */
  private clock?: ReturnType<typeof setTimeout>

  constructor() {
    addEventListener('message', this.receive)
  }

  /** 用新程序替换当前的程序，同名的状态保留。卡死的程序会被整个换掉，状态也一起丢弃。 */
  run(program: string): void {
    if (program === this.program) return
    this.program = program
    if (this.frame) return this.send({ program })
    // 还没有 iframe 就创建一个，等 Worker 就绪后再把程序发过去。
    this.frame = document.createElement('iframe')
    // 只开放脚本权限：不给 allow-same-origin，iframe 就没有源，读不到本页面的任何数据。
    this.frame.sandbox.add('allow-scripts')
    this.frame.srcdoc = RUNNER
    this.frame.hidden = true
    document.body.append(this.frame)
  }

  /** 调用 `path` 位置上那个标签的 `name` 事件处理函数。 */
  emit = (path: number[], name: string, args: unknown[]): void => this.send({ event: { path, name, args } })

  /** 订阅显示内容的变化，返回取消订阅的函数。 */
  subscribe = (watcher: () => void): (() => void) => {
    this.watchers.add(watcher)
    return () => this.watchers.delete(watcher)
  }

  /** 是否还有组件在显示它。 */
  get watched(): boolean {
    return this.watchers.size > 0
  }

  dispose(): void {
    removeEventListener('message', this.receive)
    this.stop()
  }

  /** 终止程序：移除 iframe，里面的 Worker 随之结束。 */
  private stop(): void {
    this.frame?.remove()
    this.frame = undefined
    this.ready = false
    this.settle(this.owed)
  }

  /** 发送一条指令，并开始等它的回复。Worker 还没就绪时不发：就绪后会收到当前的程序。 */
  private send(command: Command): void {
    if (!this.ready) return
    this.frame!.contentWindow!.postMessage(command, '*')
    if (!this.owed++) this.settle(0)
  }

  /** 从没回复的指令数里减去 `answered` 条，并为剩下的重新计时。 */
  private settle(answered: number): void {
    this.owed = Math.max(0, this.owed - answered)
    clearTimeout(this.clock)
    if (this.owed) {
      this.clock = setTimeout(() => {
        this.stop()
        this.show({ tree: [], error: 'the program stopped responding' })
      }, TIMEOUT_MS)
    }
  }

  /** 更新显示内容，并通知订阅者。 */
  private show(shown: Shown): void {
    if (shown.error) console.warn('[intelligent-ui]', shown.error)
    this.shown = shown
    for (const watcher of this.watchers) watcher()
  }

  /** 处理消息，只接受自己那个 iframe 发来的。 */
  private receive = ({ source, data }: MessageEvent<Report | null>): void => {
    if (!this.frame || source !== this.frame.contentWindow || typeof data !== 'object' || data === null) return
    if ('ready' in data) {
      this.ready = true
      return this.send({ program: this.program })
    }
    // 程序也可能自己重绘，所以回复可能比指令多。
    this.settle(1)
    this.show('tree' in data ? { tree: items(JSON.parse(data.tree)) } : { tree: [], error: data.error })
  }
}

/** 还活着的沙箱，按界面区分。组件卸载后沙箱仍然保留，直到被更新的界面挤出去。 */
const live = new Map<string, Sandbox>()
/** 最多同时保留的沙箱数。 */
const LIMIT = 8

/** 取得某个界面的沙箱，没有就新建；达到上限时先销毁没人在看的旧沙箱。 */
export function sandboxOf(id: string): Sandbox {
  const known = live.get(id)
  if (known) return known
  for (const [other, sandbox] of live) {
    if (live.size < LIMIT) break
    if (sandbox.watched) continue
    sandbox.dispose()
    live.delete(other)
  }
  const sandbox = new Sandbox()
  live.set(id, sandbox)
  return sandbox
}

export function disposeSandboxes(): void {
  for (const sandbox of live.values()) sandbox.dispose()
  live.clear()
}

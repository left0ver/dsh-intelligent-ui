/**
 * Where model-written programs run: a Worker inside a frame that has no origin
 * and no network. The frame keeps the program away from this page's data and
 * from every server; the Worker keeps it away from any DOM and off this thread.
 * All a program can do is post a tree describing what to show.
 */
import type { Command, Item, Report } from '../dil/protocol.ts'

/** The frame's whole document: start the Worker and relay messages both ways. */
const RUNNER = `<!doctype html>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:">
<script>
  const worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(__WORKER__).replace(/</g, '\\u003c')}])))
  worker.onmessage = event => parent.postMessage(event.data, '*')
  onmessage = event => event.source === parent && worker.postMessage(event.data)
</script>`

/** Keep only what the renderer can show; a program can post anything. */
const items = (value: unknown): Item[] => (Array.isArray(value) ? value : []).flatMap((item): Item[] => {
  if (typeof item === 'string') return [item]
  if (typeof item?.t !== 'string') return []
  return [{ t: item.t, p: typeof item.p === 'object' && item.p !== null ? item.p : {}, c: items(item.c) }]
})

/** How long a program may leave a command unanswered before it counts as hung. */
const TIMEOUT_MS = 2000

/** What a sandbox has to show: the tree its program painted last, or why there is none. */
export interface Shown {
  tree: Item[]
  error?: string
}

export class Sandbox {
  shown: Shown = { tree: [] }
  private frame?: HTMLIFrameElement
  private watchers = new Set<() => void>()
  private program = ''
  private ready = false
  /** Commands the program has not answered yet, and the clock running since the oldest of them could have been. */
  private owed = 0
  private clock?: ReturnType<typeof setTimeout>

  constructor() {
    addEventListener('message', this.receive)
  }

  /** Run a program in place of the current one; state carries over by name. A hung program is replaced, state and all. */
  run(program: string): void {
    if (program === this.program) return
    this.program = program
    if (this.frame) return this.send({ program })
    this.frame = document.createElement('iframe')
    this.frame.sandbox.add('allow-scripts')
    this.frame.srcdoc = RUNNER
    this.frame.hidden = true
    document.body.append(this.frame)
  }

  /** Call the handler `name` of the tag at `path`. */
  emit = (path: number[], name: string, args: unknown[]): void => this.send({ event: { path, name, args } })

  subscribe = (watcher: () => void): (() => void) => {
    this.watchers.add(watcher)
    return () => this.watchers.delete(watcher)
  }

  get watched(): boolean {
    return this.watchers.size > 0
  }

  dispose(): void {
    removeEventListener('message', this.receive)
    this.stop()
  }

  /** End the program; the frame takes its Worker with it. */
  private stop(): void {
    this.frame?.remove()
    this.frame = undefined
    this.ready = false
    this.settle(this.owed)
  }

  private send(command: Command): void {
    if (!this.ready) return
    this.frame!.contentWindow!.postMessage(command, '*')
    if (!this.owed++) this.settle(0)
  }

  /** Take `answered` commands off what is owed, and time the program anew on the rest. */
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

  private show(shown: Shown): void {
    if (shown.error) console.warn('[intelligent-ui]', shown.error)
    this.shown = shown
    for (const watcher of this.watchers) watcher()
  }

  private receive = ({ source, data }: MessageEvent<Report | null>): void => {
    if (!this.frame || source !== this.frame.contentWindow || typeof data !== 'object' || data === null) return
    if ('ready' in data) {
      this.ready = true
      return this.send({ program: this.program })
    }
    // A program may also paint on its own, so it can answer more often than it was asked.
    this.settle(1)
    this.show('tree' in data ? { tree: items(JSON.parse(data.tree)) } : { tree: [], error: data.error })
  }
}

/** Live sandboxes, by interface. Each outlives the views showing it until newer ones crowd it out. */
const live = new Map<string, Sandbox>()
const LIMIT = 8

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

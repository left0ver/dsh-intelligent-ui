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

export class Sandbox {
  /** What the program painted last. */
  tree: Item[] = []
  private frame = document.createElement('iframe')
  private watchers = new Set<() => void>()
  private program = ''
  private ready = false

  constructor() {
    this.frame.sandbox.add('allow-scripts')
    this.frame.srcdoc = RUNNER
    this.frame.hidden = true
    addEventListener('message', this.receive)
    document.body.append(this.frame)
  }

  /** Run a program in place of the current one; state carries over by name. */
  run(program: string): void {
    if (program === this.program) return
    this.program = program
    if (this.ready) this.send({ program })
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
    this.frame.remove()
  }

  private send(command: Command): void {
    this.frame.contentWindow?.postMessage(command, '*')
  }

  private receive = ({ source, data }: MessageEvent<Report | null>): void => {
    if (source !== this.frame.contentWindow || typeof data !== 'object' || data === null) return
    if ('ready' in data) {
      this.ready = true
      this.send({ program: this.program })
    } else if ('tree' in data) {
      this.tree = items(JSON.parse(data.tree))
      for (const watcher of this.watchers) watcher()
    } else console.warn('[intelligent-ui]', data.error)
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

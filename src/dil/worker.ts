/** Worker entry: the runtime, wired to the thread's message port. */
import { createRuntime } from './runtime.ts'

const receive = createRuntime(report => postMessage(report))
onmessage = event => receive(event.data)
postMessage({ ready: true })

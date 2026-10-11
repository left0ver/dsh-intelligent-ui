/** Worker 入口：把运行时接到线程的消息通道上。 */
import { createRuntime } from './runtime.ts'

const receive = createRuntime(report => postMessage(report))
onmessage = event => receive(event.data)
// 告诉外面可以开始发送指令了。
postMessage({ ready: true })

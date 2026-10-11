/**
 * `pnpm dev:mock` 使用的假模型。不管提示词是什么，它都回复一次 `render_ui` 调用，
 * 源码是参考示例，并按阅读的速度逐段输出，这样不需要 API key 就能调试流式显示。
 *
 * 提示词写成 `dil:` 加一段源码时，它改为输出这段源码；被宿主端打回后，再退回到示例。
 * 写成 `dil!:` 时，它每次都输出同一段源码，只是换一个标题：一模一样的调用重复出现时，
 * dsh 会介入。
 *
 * 环境变量 `DIL_SAMPLE` 可以指定另一个文件来代替示例，文件名就是界面的标题。
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, type GenerateOptions, type StreamChunk, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { TOOL } from '../src/shared.ts'

/** 插件名，以及它依赖的 dsh 服务。 */
export const name = 'mock-model'
export const inject = ['llm']

/** 默认输出的源码文件。 */
const SAMPLE = process.env.DIL_SAMPLE ?? new URL('../src/dil/example.dil', import.meta.url).pathname
/** 界面的标题：文件名去掉 `.dil`。 */
const TITLE = basename(SAMPLE, '.dil')
/** 每段输出的字符数。 */
const CHUNK = 12
/** 每段之后的停顿。 */
const PAUSE_MS = 40

/** 根据对话内容决定这次输出哪段源码。 */
function sourceFor(messages: GenerateOptions['messages']): string {
  // 用户亲手输入的最后一条消息。
  const typed = messages.findLast(message => message.role === 'user' && message.source?.kind === 'user')
  const text = typed?.content.map(block => block.type === 'text' ? block.text : '').join('') ?? ''
  const [, insist, own] = /^dil(!?):([\s\S]*)$/.exec(text) ?? []
  return own !== undefined && (insist || messages.at(-1)?.role !== 'tool') ? own : readFileSync(SAMPLE, 'utf8')
}

/** 假模型：以流的形式产出一次 `render_ui` 调用。 */
class MockModel extends LlmAdapter {
  async *stream({ tools, messages }: GenerateOptions): AsyncIterable<StreamChunk> {
    // 不带这个工具的请求（比如生成会话标题）直接回复一段文字。
    if (!tools?.some(tool => tool.name === TOOL)) {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: TITLE }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: TITLE } }
      yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    const id = `call-${Date.now()}` as ToolCallId
    // 之前已经调用过几次；重试时标题带上序号，让每次调用都不一样。
    const earlier = messages.filter(message => message.role === 'tool').length
    const args = JSON.stringify({ title: earlier ? `${TITLE}, take ${earlier + 1}` : TITLE, source: sourceFor(messages) })
    yield { type: 'block-start', index: 0, blockType: 'tool-call' }
    // 把参数切成小段逐段输出，模拟模型的流式输出。
    for (let at = 0; at < args.length; at += CHUNK) {
      yield { type: 'tool-call-delta', index: 0, id, name: TOOL, argumentsDelta: args.slice(at, at + CHUNK) }
      await sleep(PAUSE_MS)
    }
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: TOOL, arguments: args } }
    yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  }
}

/** 插件入口：把假模型注册成名为 `mock` 的 provider。 */
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['mock'], new MockModel())
}

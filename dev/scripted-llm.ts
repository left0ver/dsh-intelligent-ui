/**
 * Dev-only model. Whatever the prompt, it answers with one `render_ui` call
 * whose source is the reference example, written out at reading speed, so the streaming
 * display can be exercised without an API key.
 *
 * A prompt of `dil:` and a source makes it write that source instead, and fall
 * back on the example once the host has turned the source down. `dil!:` makes
 * it write the same source every time, under a new title: dsh steps in when a
 * call is repeated word for word.
 *
 * `DIL_SAMPLE` names another file to answer with in place of the example; the
 * file's name is the interface's title.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, type GenerateOptions, type StreamChunk, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { TOOL } from '../src/shared.ts'

export const name = 'scripted-llm'
export const inject = ['llm']

const SAMPLE = process.env.DIL_SAMPLE ?? new URL('../src/dil/example.dil', import.meta.url).pathname
const TITLE = basename(SAMPLE, '.dil')
/** Characters per chunk, and the pause after each chunk. */
const CHUNK = 12
const PAUSE_MS = 40

/** The source to write in answer to these messages. */
function sourceFor(messages: GenerateOptions['messages']): string {
  const typed = messages.findLast(message => message.role === 'user' && message.source?.kind === 'user')
  const text = typed?.content.map(block => block.type === 'text' ? block.text : '').join('') ?? ''
  const [, insist, own] = /^dil(!?):([\s\S]*)$/.exec(text) ?? []
  return own !== undefined && (insist || messages.at(-1)?.role !== 'tool') ? own : readFileSync(SAMPLE, 'utf8')
}

class ScriptedModel extends LlmAdapter {
  async *stream({ tools, messages }: GenerateOptions): AsyncIterable<StreamChunk> {
    // A request that cannot call the tool (a session title) gets a plain reply.
    if (!tools?.some(tool => tool.name === TOOL)) {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: TITLE }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: TITLE } }
      yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    const id = `call-${Date.now()}` as ToolCallId
    const earlier = messages.filter(message => message.role === 'tool').length
    const args = JSON.stringify({ title: earlier ? `${TITLE}, take ${earlier + 1}` : TITLE, source: sourceFor(messages) })
    yield { type: 'block-start', index: 0, blockType: 'tool-call' }
    for (let at = 0; at < args.length; at += CHUNK) {
      yield { type: 'tool-call-delta', index: 0, id, name: TOOL, argumentsDelta: args.slice(at, at + CHUNK) }
      await sleep(PAUSE_MS)
    }
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: TOOL, arguments: args } }
    yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  }
}

export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['scripted'], new ScriptedModel())
}

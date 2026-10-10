/**
 * Dev-only model. Whatever the prompt, it answers with one `render_ui` call
 * whose source is the reference example, written out at reading speed, so the streaming
 * display can be exercised without an API key.
 */
import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import { LlmAdapter, type GenerateOptions, type StreamChunk, type ToolCallId } from '@deepseek-ai/dsh-llm'
import { TOOL } from '../src/shared.ts'

export const name = 'scripted-llm'
export const inject = ['llm']

const SAMPLE = new URL('../src/dil/example.dil', import.meta.url)
/** Characters per chunk, and the pause after each chunk. */
const CHUNK = 12
const PAUSE_MS = 40

class ScriptedModel extends LlmAdapter {
  async *stream({ tools }: GenerateOptions): AsyncIterable<StreamChunk> {
    // A request that cannot call the tool (a session title) gets a plain reply.
    if (!tools?.some(tool => tool.name === TOOL)) {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: 'Sample' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Sample' } }
      yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    const id = `call-${Date.now()}` as ToolCallId
    const args = JSON.stringify({ title: 'Sample', source: readFileSync(SAMPLE, 'utf8') })
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

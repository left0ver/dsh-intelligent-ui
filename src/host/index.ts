/** Host half: gives the model a tool whose call is the interface, and teaches it the language. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { check } from '../dil/check.ts'
import example from '../dil/example.dil'
import { VOCABULARY } from '../dil/vocabulary.ts'
import { TOOL } from '../shared.ts'

export const name = 'intelligent-ui'
export const inject = ['tools']

const DESCRIPTION = `Answer with an interactive interface instead of prose. Use it when the user would otherwise have to ask again to explore: calculators, configurators, comparisons, filters, dashboards. The interface appears as you write it and computes in the user's browser, with no further request to you. Make this call the last action of your turn and do not repeat its content in text. If the call fails, fix what it reports and call again with the whole source.

\`source\` is written in DIL: Markdown prose, state and derived values, then elements.

{@body const [count, setCount] = DIL.useState(0)}   state; one declaration per {@body}
{@body const double = count * 2}                    derived value: any JavaScript, recomputed on every change
<tag name="text" name={expression}>children</tag>   element; {expression} also interpolates inside children
{#if condition}…{:else}…{/if}
{#each rows as row, index}…{/each}

Rules:
- Only the elements below exist. No HTML, CSS, imports, timers, or network.
- Each {@body} holds one complete statement.
- Close every element; self-close those without children.

Elements:
${Object.entries(VOCABULARY).map(([tag, props]) => `<${tag}> ${props}`).join('\n')}

Example:
${example}`

/** How many broken sources in a row are turned down before one is shown as it is. */
const RETRIES = 2

export function apply(ctx: Context): void {
  /** Sources turned down in a row, per agent. */
  const refused = new WeakMap<object, number>()

  ctx.tools.register(defineTool({
    name: TOOL,
    description: DESCRIPTION,
    parameters: {
      title: { type: 'string', required: true, description: 'Short name of the interface.' },
      source: { type: 'string', required: true, description: 'DIL source of the interface.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const agent = exec.agent ?? ctx
      const problems = check(args.source)
      const count = refused.get(agent) ?? 0
      if (problems.length && count < RETRIES) {
        refused.set(agent, count + 1)
        throw new Error(`the interface was not shown.\n${problems.map(problem => `- ${problem}`).join('\n')}`)
      }
      refused.delete(agent)
      // The interface is the answer: no further model request follows it.
      exec.concludeTurn()
      return `Showing "${args.title}" to the user.`
    },
  }))
}

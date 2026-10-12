/** 宿主端：给模型一个工具，调用它就是在写界面；工具描述负责教会模型这门语言。 */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { check } from '../dil/check.ts'
import example from '../dil/example.dil'
import { VOCABULARY } from '../dil/vocabulary.ts'
import { TOOL } from '../shared.ts'

/** 插件名，以及它依赖的 dsh 服务。 */
export const name = 'intelligent-ui'
export const inject = ['tools']

/** 工具描述，也是模型学习 DIL 的全部材料：用途、语法、规则、元素列表和一个完整示例。 */
const DESCRIPTION = `Answer with an interactive interface instead of prose. Use it when the user would otherwise have to ask again to explore: calculators, configurators, comparisons, filters, dashboards. The interface appears as you write it and computes in the user's browser, with no further request to you. Make this call the last action of your turn and do not repeat its content in text. If the call fails, fix what it reports and call again with the whole source.

\`source\` is written in DIL: Markdown prose, state and derived values, then elements.

{@body const [count, setCount] = DIL.useState(0)}   state; one declaration per {@body}
{@body const double = count * 2}                    derived value: any JavaScript, recomputed on every change
<tag name="text" name={expression}>children</tag>   element; {expression} also interpolates inside children
{#if condition}…{:else if other}…{:else}…{/if}
{#each rows as row, index}…{/each}

Rules:
- Only the elements below exist, and only with the attributes listed. No HTML tags, CSS, or style and class attributes.
- Each {@body} holds one complete statement.
- Close every element; self-close those without children.
- Do not write comments.

Not supported. These show up as literal text or do nothing:
- Markdown, HTML or image syntax inside an element or in a computed value. Markdown works only in prose written outside elements, and that prose is static: put anything computed inside an element.
- Images, icons, colors, SVG and custom styling. The only emphasis is \`tone\` and <title>; emoji are fine.
- document, window, storage, network, imports and timers. The code is plain JavaScript in a sandbox; standard built-ins such as Math, Date, Intl and JSON work.

Elements:
${Object.entries(VOCABULARY).map(([tag, props]) => `<${tag}> ${props}`).join('\n')}

Example:
${example}`

/** 有问题的源码连续被打回这么多次之后，下一份就不再打回，照原样显示。 */
const RETRIES = 2

/** 插件入口：注册 `render_ui` 工具。 */
export function apply(ctx: Context): void {
  /** 每个 agent 已经连续被打回的次数。 */
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
      // 有问题就抛错：dsh 把错误信息作为工具结果交给模型，模型据此重写。
      if (problems.length && count < RETRIES) {
        refused.set(agent, count + 1)
        throw new Error(`the interface was not shown.\n${problems.map(problem => `- ${problem}`).join('\n')}`)
      }
      refused.delete(agent)
      // 界面本身就是回答：之后不再请求模型。
      exec.concludeTurn()
      return `Showing "${args.title}" to the user.`
    },
  }))
}

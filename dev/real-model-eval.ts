/**
 * `pnpm eval`：让真实模型生成界面，统计其中有多少能正常工作。
 *
 * 每条提示词都通过加载了本插件的 `dsh headless` 执行，所以用的是 dsh 当前配置的
 * 模型和账号，每条提示词会留下一个会话。模型写出的源码保存在 `dev/eval-results/`。
 */
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import { check } from '../src/dil/check.ts'
import { compile } from '../src/dil/compile.ts'
import { PARAMETERS } from '../src/dil/protocol.ts'
import { TOOL } from '../src/shared.ts'

/** 评测用的提示词，覆盖计算器、对比、清单、测验、表格和图表等常见界面。 */
const PROMPTS = [
  '做一个房贷计算器，可以调整贷款金额、年限和利率，显示月供和总利息',
  '我想比较 iPhone 分 12 期和 24 期哪个划算，做个可以调手续费率的对比工具',
  '做一个 BMI 计算器，输入身高体重，显示结果和所属区间',
  'Build a unit converter for length, weight and temperature',
  '帮我做一个旅行预算规划器：天数、每日住宿、餐饮、交通，还有可勾选的额外项目',
  'A tip calculator that splits the bill between a number of people',
  '做一个复利计算器，展示每年的本金和收益明细表',
  '做一个番茄钟安排器：输入开始时间、任务数量和每个番茄的长度，列出时间表',
  'Make a quiz with 5 questions about the solar system and show my score',
  '做一个待办清单，可以添加、勾选完成和按状态筛选',
  'Compare three laptop configurations in a table and let me filter by budget and weight',
  '做一个个税计算器（中国综合所得），可以输入月薪、五险一金和专项附加扣除',
  '用图表对比每月定投和一次性投入，在不同年化收益率下 20 年的资产变化',
  '我在纠结买电动车还是燃油车。帮我做一个对比工具：可以调两种车的车价、每年行驶里程、油价、电价、百公里油耗和电耗，还能勾选有没有家用充电桩。用折线图画出两种车 10 年的累计花费，告诉我第几年回本，再给一张逐年明细表。',
]
/** 同时执行的提示词数量。 */
const PARALLEL = 3
/** 结果的保存目录。 */
const OUT = 'dev/eval-results'

/** `dsh headless --json` 输出的运行事件里，本脚本用到的字段。 */
interface Event {
  type: string
  tool?: string
  callId?: string
  status?: string
  result?: unknown
  input?: { source?: string }
  usage?: { totalTokens?: number }
}

/** 一条提示词的评测结果。 */
interface Result {
  prompt: string
  /** `render_ui` 的调用次数。 */
  calls: number
  /** 被打回的那些调用各自收到的错误信息。 */
  refused: string[]
  /** 最终显示的那份源码里，静态检查发现的问题。 */
  problems: string[]
  /** 最终显示的那份源码首次渲染时抛出的错误。 */
  errors: string[]
  /** 耗时，单位秒。 */
  seconds: number
  /** 消耗的 token 数。 */
  tokens: number
}

/**
 * 收集源码首次渲染时抛出的错误。程序在一个空的 JavaScript 环境里执行，
 * 里面只有语言本身，没有 Node 的任何能力。
 */
function firstPaint(source: string): string[] {
  try {
    return JSON.parse(runInNewContext(`
      const errors = new Set()
      const $ = evaluate => { try { return evaluate() } catch (error) { errors.add(String(error)) } }
      const DIL = { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] }
      $(() => new Function(...${JSON.stringify(PARAMETERS)}, ${JSON.stringify(compile(source).program)})(DIL, (t, p, ...c) => ({ t, p, c }), $))
      JSON.stringify([...errors])`, undefined, { timeout: 2000 }))
  } catch (error) {
    return [String(error)]
  }
}

/** 用一条提示词请求模型，保存它写出的源码，并评估这份源码。 */
async function ask(prompt: string, index: number, cwd: string): Promise<Result> {
  const started = Date.now()
  const { stdout } = await promisify(execFile)('dsh', ['headless', '--patch', resolve('dev.patch.yml'), '--json', prompt], { cwd, maxBuffer: 1 << 26 })
  const events = stdout.split('\n').filter(Boolean).map(line => JSON.parse(line) as Event)
  const calls = events.filter(event => event.type === 'tool_call' && event.tool === TOOL)
  // 最后一次调用的源码就是用户最终看到的界面。
  const source = calls.at(-1)?.input?.source ?? ''
  writeFileSync(join(OUT, `${String(index + 1).padStart(2, '0')}.dil`), source)
  return {
    prompt,
    calls: calls.length,
    refused: events
      .filter(event => event.type === 'tool_result' && event.status !== 'completed' && calls.some(call => call.callId === event.callId))
      .map(event => JSON.stringify(event.result)),
    problems: check(source),
    errors: firstPaint(source),
    seconds: Math.round((Date.now() - started) / 1000),
    tokens: events.reduce((sum, event) => sum + (event.usage?.totalTokens ?? 0), 0),
  }
}

/** 一句话结论：没有生成界面、界面有问题、重试几次后成功，或一次成功。 */
const verdict = ({ calls, refused, problems, errors }: Result) =>
  !calls ? 'no interface' : problems.length + errors.length ? 'broken' : refused.length ? `after ${refused.length} retries` : 'first try'

mkdirSync(OUT, { recursive: true })
// 模型可能会写文件，让它们落在一个单独的临时目录里。
const cwd = mkdtempSync(join(tmpdir(), 'dsh-iui-eval-'))
const queue = [...PROMPTS.entries()]
const results: Result[] = []
// 开 PARALLEL 路并发，每一路从队列里依次取提示词。
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let job; (job = queue.shift());) {
    results[job[0]] = await ask(job[1], job[0], cwd)
    console.error(`${job[0] + 1}/${PROMPTS.length} ${verdict(results[job[0]])}`)
  }
}))

// 保存完整结果，再逐条打印结论，最后打印汇总。
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2))
for (const [index, result] of results.entries()) {
  console.log(`${String(index + 1).padStart(2)}  ${verdict(result).padEnd(16)} ${String(result.seconds).padStart(3)}s ${String(result.tokens).padStart(6)} tok  ${result.prompt}`)
  for (const line of [...result.refused.map(said => `turned down: ${said}`), ...result.problems, ...result.errors]) console.log(`      ${line}`)
}
/** 符合条件的结果占全部的几分之几。 */
const count = (wanted: (result: Result) => boolean) => `${results.filter(wanted).length}/${results.length}`
console.log(`\nfirst try ${count(result => verdict(result) === 'first try')}, working in the end ${count(result => /first|after/.test(verdict(result)))}, ${results.reduce((sum, result) => sum + result.refused.length, 0)} sources turned down`)

/**
 * 每个元素在页面上的渲染。属性是模型写的代码算出来的，什么值都有可能，
 * 所以每个组件读属性时都先转成需要的类型，不把任何属性原样传给 DOM。
 */
import { useState, type ChangeEvent, type ReactNode } from 'react'
import type { VOCABULARY } from '../dil/vocabulary.ts'
import { Chart } from './chart.tsx'

type Props = Record<string, unknown>
interface ViewProps {
  /** 程序给这个元素算出的属性。 */
  p: Props
  /** 调用程序写在这个元素上的事件处理函数。 */
  on: (name: string, ...args: unknown[]) => void
  children?: ReactNode
}
/** 一个元素的渲染组件。 */
type View = (props: ViewProps) => ReactNode

/** 转成字符串；既不是字符串也不是数字时为空串。 */
const str = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
/** 转成数字；没有值或不是数字时用 `fallback`。 */
const num = (value: unknown, fallback: number) => value == null || Number.isNaN(Number(value)) ? fallback : Number(value)
/** 转成对象数组，用作表格和图表的行。 */
const rows = (value: unknown) => (Array.isArray(value) ? value : []).map((row: unknown) => typeof row === 'object' && row !== null ? row as Props : {})

/** 转成选项列表。选项和表格的列可以写成 `{label, value}`，也可以直接写值；写了别的字段也保留。 */
const options = (value: unknown) => (Array.isArray(value) ? value : []).map((option: unknown): Props & { label: string } => {
  const fields: Props = typeof option === 'object' && option !== null ? option as Props : { value: option }
  return { ...fields, label: str(fields.label ?? fields.value), value: fields.value }
})
/** 把值读成数字，排序时用：`¥4,490`、`+5%` 这样的文字只看其中的数；读不出来是 NaN。 */
const amount = (value: unknown) => typeof value === 'number' ? value : parseFloat(str(value).replace(/[^\d.+-]/g, ''))
/** 排序时比较两个值：先比读出的数，读不出或一样大时比文字。 */
const order = (a: unknown, b: unknown) => amount(a) - amount(b) || str(a).localeCompare(str(b), undefined, { numeric: true })

/** 让控件立刻显示用户的输入；程序算出的值稍后才到，到了以程序的为准。 */
function useEcho<T>(value: T, change: (next: T) => void): [T, (next: T) => void] {
  const [shown, setShown] = useState(value)
  const [last, setLast] = useState(value)
  // 程序给的值变了：改为显示它。
  if (value !== last) {
    setLast(value)
    setShown(value)
  }
  return [shown, (next) => {
    setShown(next)
    change(next)
  }]
}

/** 带标签的一栏；`note` 显示在标签右侧，滑块用它显示当前值。 */
function Field({ label, note, children }: { label: unknown; note?: string; children: ReactNode }) {
  return (
    <label className="iui-field">
      <span>{str(label)}<output>{note}</output></span>
      {children}
    </label>
  )
}

function Slider({ p, on }: ViewProps) {
  const [value, change] = useEcho(num(p.value, 0), next => on('onChange', next))
  return (
    <Field label={p.label} note={String(value)}>
      <input type="range" min={num(p.min, 0)} max={num(p.max, 100)} step={num(p.step, 1)} value={value}
        onChange={event => change(Number(event.target.value))} />
    </Field>
  )
}

function Input({ p, on }: ViewProps) {
  const type = str(p.type)
  const [value, change] = useEcho(str(p.value), next => on('onChange', type === 'number' ? Number(next) : next))
  /** 单行和多行输入框共用的属性。 */
  const shared = {
    className: 'iui-input',
    placeholder: str(p.placeholder),
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(event.target.value),
  }
  return (
    <Field label={p.label}>
      {type === 'multiline' ? <textarea rows={4} {...shared} /> : <input type={type === 'number' || type === 'date' ? type : 'text'} {...shared} />}
    </Field>
  )
}

function Select({ p, on }: ViewProps) {
  const choices = options(p.options)
  const [value, change] = useEcho(p.value, next => on('onChange', next))
  // 选项的值可以是任意类型，所以 `<option>` 用下标作值。
  return (
    <Field label={p.label}>
      <select className="iui-input" value={choices.findIndex(choice => choice.value === value)}
        onChange={event => change(choices[Number(event.target.value)]?.value)}>
        {choices.map((choice, index) => <option key={index} value={index}>{choice.label}</option>)}
      </select>
    </Field>
  )
}

function Checkbox({ p, on }: ViewProps) {
  const [checked, change] = useEcho(Boolean(p.checked), next => on('onChange', next))
  return (
    <label className="iui-check">
      <input type="checkbox" checked={checked} onChange={event => change(event.target.checked)} />
      {str(p.label)}
    </label>
  )
}

function Table({ p }: ViewProps) {
  const columns = options(p.columns)
  /** 用户点表头选的排序：按第几列，是否从大到小。没点过就按程序给的顺序。 */
  const [sort, setSort] = useState<{ at: number; down: boolean }>()
  /** 点一次从小到大，再点从大到小，第三次恢复原来的顺序。 */
  const toggle = (at: number) => setSort(sort?.at !== at ? { at, down: false } : sort.down ? undefined : { at, down: true })
  const body = rows(p.rows)
  if (sort && columns[sort.at]) {
    const field = str(columns[sort.at].value)
    body.sort((a, b) => order(a[field], b[field]) * (sort.down ? -1 : 1))
  }
  return (
    <table className="iui-table" data-sortable={p.sortable ? '' : undefined}>
      <thead>
        <tr>
          {columns.map((column, at) => (
            <th key={at} data-align={str(column.align)} aria-sort={sort?.at !== at ? undefined : sort.down ? 'descending' : 'ascending'}
              onClick={p.sortable ? () => toggle(at) : undefined}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, index) => (
          <tr key={index}>
            {columns.map((column, at) => (
              <td key={at} data-align={str(column.align)} data-tone={str(row[str(column.tone)])}>{str(row[str(column.value)])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** `align` / `justify` 的取值对应的 flex 写法。 */
const FLEX: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }

/** 元素名到渲染组件的对应，`VOCABULARY` 里的每个元素都有一项。 */
export const views: Record<keyof typeof VOCABULARY, View> = {
  box: ({ p, children }) => (
    <div className="iui-box" data-direction={p.direction === 'row' ? 'row' : 'column'} style={{
      flexDirection: p.direction === 'row' ? 'row' : 'column',
      // `gap` 以 4px 为一档。
      gap: num(p.gap, 3) * 4,
      alignItems: FLEX[str(p.align)],
      justifyContent: FLEX[str(p.justify)],
      flexWrap: p.wrap ? 'wrap' : undefined,
    }}>{children}</div>
  ),
  card: ({ p, children }) => (
    <section className="iui-card">
      {p.title ? <header>{str(p.title)}</header> : null}
      {children}
    </section>
  ),
  title: ({ p, children }) => <div className="iui-title" data-size={str(p.size)}>{children}</div>,
  text: ({ p, children }) => <div className="iui-text" data-tone={str(p.tone)}>{children}</div>,
  stat: ({ p }) => (
    <div className="iui-stat" data-tone={str(p.tone)}>
      <span>{str(p.label)}</span>
      <strong>{str(p.value)}</strong>
      <span>{str(p.hint)}</span>
    </div>
  ),
  slider: Slider,
  input: Input,
  select: Select,
  checkbox: Checkbox,
  tabs: ({ p, on }) => (
    <div className="iui-tabs" role="tablist">
      {options(p.options).map((option, index) => (
        <button key={index} type="button" role="tab" aria-selected={option.value === p.value}
          onClick={() => on('onChange', option.value)}>{option.label}</button>
      ))}
    </div>
  ),
  button: ({ p, on, children }) => (
    <button className="iui-button" type="button" data-variant={str(p.variant)} onClick={() => on('onClick')}>{children}</button>
  ),
  table: Table,
  chart: ({ p }) => {
    const points = rows(p.rows)
    // 不是有限数值的一律按 0 画：算坐标时要除以这些数值的范围。
    const finite = (value: unknown) => Number.isFinite(num(value, 0)) ? num(value, 0) : 0
    return (
      <Chart type={str(p.type)} labels={points.map(row => str(row[str(p.x)]))}
        series={options(p.series).map(({ label, value }) => ({ label, values: points.map(row => finite(row[str(value)])) }))} />
    )
  },
}

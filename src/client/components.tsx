/**
 * This page's own rendering of each element. Props are whatever model-written
 * code produced, so a view coerces each one it reads and passes none through
 * to the DOM as they are.
 */
import { useState, type ReactNode } from 'react'
import type { VOCABULARY } from '../dil/vocabulary.ts'

type Props = Record<string, unknown>
interface ViewProps {
  p: Props
  /** Call the handler the program put on this element. */
  on: (name: string, ...args: unknown[]) => void
  children?: ReactNode
}
type View = (props: ViewProps) => ReactNode

const str = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : ''
const num = (value: unknown, fallback: number) => value == null || Number.isNaN(Number(value)) ? fallback : Number(value)

/** Options and columns are written as `{label, value}` or as bare values. */
const options = (value: unknown) => (Array.isArray(value) ? value : []).map((option: unknown) => {
  const { label, value } = typeof option === 'object' && option !== null ? option as Props : { value: option } as Props
  return { label: str(label ?? value), value }
})

/** A control shows the user's input at once; the program's value arrives a moment later and wins. */
function useEcho<T>(value: T, change: (next: T) => void): [T, (next: T) => void] {
  const [shown, setShown] = useState(value)
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setShown(value)
  }
  return [shown, (next) => {
    setShown(next)
    change(next)
  }]
}

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
  const numeric = p.type === 'number'
  const [value, change] = useEcho(str(p.value), next => on('onChange', numeric ? Number(next) : next))
  return (
    <Field label={p.label}>
      <input className="iui-input" type={numeric ? 'number' : 'text'} placeholder={str(p.placeholder)} value={value}
        onChange={event => change(event.target.value)} />
    </Field>
  )
}

function Select({ p, on }: ViewProps) {
  const choices = options(p.options)
  const [value, change] = useEcho(p.value, next => on('onChange', next))
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

const FLEX: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }

export const views: Record<keyof typeof VOCABULARY, View> = {
  box: ({ p, children }) => (
    <div className="iui-box" style={{
      flexDirection: p.direction === 'row' ? 'row' : 'column',
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
  text: ({ p, children }) => <p className="iui-text" data-tone={str(p.tone)}>{children}</p>,
  stat: ({ p }) => (
    <div className="iui-stat">
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
  table: ({ p }) => {
    const columns = options(p.columns)
    return (
      <table className="iui-table">
        <thead><tr>{columns.map((column, index) => <th key={index}>{column.label}</th>)}</tr></thead>
        <tbody>
          {(Array.isArray(p.rows) ? p.rows as Props[] : []).map((row, index) => (
            <tr key={index}>{columns.map((column, at) => <td key={at}>{str(row?.[str(column.value)])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    )
  },
}

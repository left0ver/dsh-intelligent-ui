/** Line and bar charts, drawn as plain SVG. */
import { axis } from './axis.ts'

/** One line, or one bar per column: a number for each label. */
export interface Series {
  label: string
  values: number[]
}

const WIDTH = 640
const HEIGHT = 240
/** Room around the plot for the axis labels. */
const EDGE = { top: 12, right: 10, bottom: 26, left: 50 }
/** Colours repeat after this many series; `widget.css` defines them. */
const COLOURS = 6

export function Chart({ bars, labels, series }: { bars: boolean; labels: string[]; series: Series[] }) {
  const values = series.flatMap(one => one.values)
  if (!values.length) return null
  // dsh keeps the language it is set to on the document; numbers are written in it.
  const language = document.documentElement.lang || undefined
  const compact = new Intl.NumberFormat(language, { notation: 'compact' })
  // Bars grow from zero, so zero is always in view; lines show their own range.
  const marks = axis(
    values.reduce((low, value) => Math.min(low, value), bars ? 0 : Infinity),
    values.reduce((high, value) => Math.max(high, value), bars ? 0 : -Infinity),
  )
  const [floor, ceiling] = [marks[0], marks.at(-1)!]
  /** Each label has a column of the plot; a point sits in its middle, bars share most of its width. */
  const column = (WIDTH - EDGE.left - EDGE.right) / labels.length
  const bar = Math.min(40, column * 0.7 / series.length)
  const x = (index: number) => EDGE.left + column * (index + 0.5)
  const y = (value: number) => EDGE.top + (HEIGHT - EDGE.top - EDGE.bottom) * (ceiling - value) / (ceiling - floor)
  /** Name every `stride`-th column, so that at most eight are named. */
  const stride = Math.ceil(labels.length / 8)

  return (
    <figure className="iui-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
        {marks.map(mark => (
          <g key={mark}>
            <line x1={EDGE.left} x2={WIDTH - EDGE.right} y1={y(mark)} y2={y(mark)} />
            <text x={EDGE.left - 6} y={y(mark)} textAnchor="end" dominantBaseline="middle">{compact.format(mark)}</text>
          </g>
        ))}
        {labels.map((label, index) => index % stride ? null : (
          <text key={index} x={x(index)} y={HEIGHT - 8} textAnchor="middle">{label}</text>
        ))}
        {series.map((one, at) => (
          <g key={at} data-series={at % COLOURS}>
            {bars ? null : <polyline points={one.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />}
            {one.values.map((value, index) => {
              const title = <title>{`${labels[index]} · ${one.label}: ${value.toLocaleString(language)}`}</title>
              return bars
                ? <rect key={index} x={x(index) - bar * series.length / 2 + bar * at} width={bar} y={Math.min(y(value), y(0))} height={Math.abs(y(value) - y(0))}>{title}</rect>
                : <circle key={index} cx={x(index)} cy={y(value)} r={Math.min(3, column / 4)}>{title}</circle>
            })}
          </g>
        ))}
      </svg>
      {series.length > 1
        ? <figcaption>{series.map((one, at) => <span key={at} data-series={at % COLOURS}>{one.label}</span>)}</figcaption>
        : null}
    </figure>
  )
}

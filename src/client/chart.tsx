/** 折线图、柱状图、面积图和饼图，直接用 SVG 画。 */
import { axis, shares } from './axis.ts'

/** 一组数据：一条折线、一片面积，或每列里的一根柱子。每个标签对应一个数值。 */
export interface Series {
  label: string
  values: number[]
}

/** SVG 画布的尺寸（viewBox），实际大小随容器宽度缩放。 */
const WIDTH = 640
const HEIGHT = 240
/** 绘图区四周留给坐标轴文字的空间。 */
const EDGE = { top: 12, right: 10, bottom: 26, left: 50 }
/** 颜色的种数，数据组数超过它就循环使用；具体颜色在 `widget.css` 里定义。 */
const COLOURS = 8

/** 饼图：每个标签一块，大小是它的数值占总和的比例。 */
function Pie({ labels, values, language }: { labels: string[]; values: number[]; language?: string }) {
  const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 })
  const parts = shares(values)
  /** 圆心和半径。 */
  const [cx, cy, radius] = [WIDTH / 2, HEIGHT / 2, HEIGHT / 2 - 8]
  /** 圆周上的一点；`turn` 是从正上方顺时针转过的圈数。 */
  const point = (turn: number) => `${cx + radius * Math.sin(turn * 2 * Math.PI)} ${cy - radius * Math.cos(turn * 2 * Math.PI)}`
  return (
    <figure className="iui-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
        {parts.map((part, index) => {
          /** 这一块从哪里开始：前面各块加起来转过的圈数。 */
          const start = parts.slice(0, index).reduce((sum, before) => sum + before, 0)
          // 整圆的起点和终点重合，画不出弧，所以最多画到差一点满。
          const end = start + Math.min(part, 0.9999)
          return (
            <path key={index} data-series={index % COLOURS} d={`M ${cx} ${cy} L ${point(start)} A ${radius} ${radius} 0 ${part > 0.5 ? 1 : 0} 1 ${point(end)} Z`}>
              <title>{`${labels[index]}: ${values[index].toLocaleString(language)} (${percent.format(part)})`}</title>
            </path>
          )
        })}
      </svg>
      <figcaption>{parts.map((part, index) => <span key={index} data-series={index % COLOURS}>{labels[index]} {percent.format(part)}</span>)}</figcaption>
    </figure>
  )
}

/**
 * 图表。`type` 是 `bar`、`area` 或 `pie`，其余都画折线图；
 * `labels` 是各行的标签：横轴上的各列，或饼图的各块。饼图只画第一组数据。
 */
export function Chart({ type, labels, series }: { type: string; labels: string[]; series: Series[] }) {
  const values = series.flatMap(one => one.values)
  if (!values.length) return null
  // dsh 把当前的语言写在 document 上，数字按这个语言来格式化。
  const language = document.documentElement.lang || undefined
  if (type === 'pie') return <Pie labels={labels} values={series[0].values} language={language} />
  const bars = type === 'bar'
  const area = type === 'area'
  const compact = new Intl.NumberFormat(language, { notation: 'compact' })
  // 纵轴的刻度。柱子和面积从 0 开始画，所以 0 一定在范围内；折线只显示自身的数值范围。
  const marks = axis(
    values.reduce((low, value) => Math.min(low, value), bars || area ? 0 : Infinity),
    values.reduce((high, value) => Math.max(high, value), bars || area ? 0 : -Infinity),
  )
  const [floor, ceiling] = [marks[0], marks.at(-1)!]
  /** 每个标签占绘图区的一列：折线的点在列的正中，各组的柱子合起来占这一列的大部分宽度。 */
  const column = (WIDTH - EDGE.left - EDGE.right) / labels.length
  /** 单根柱子的宽度。 */
  const bar = Math.min(40, column * 0.7 / series.length)
  /** 第 `index` 列中心的横坐标。 */
  const x = (index: number) => EDGE.left + column * (index + 0.5)
  /** 数值对应的纵坐标。 */
  const y = (value: number) => EDGE.top + (HEIGHT - EDGE.top - EDGE.bottom) * (ceiling - value) / (ceiling - floor)
  /** 每隔 `stride` 列标一个横轴标签，这样最多标 8 个。 */
  const stride = Math.ceil(labels.length / 8)

  return (
    <figure className="iui-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img">
        {/* 横向的网格线和纵轴刻度 */}
        {marks.map(mark => (
          <g key={mark}>
            <line x1={EDGE.left} x2={WIDTH - EDGE.right} y1={y(mark)} y2={y(mark)} />
            <text x={EDGE.left - 6} y={y(mark)} textAnchor="end" dominantBaseline="middle">{compact.format(mark)}</text>
          </g>
        ))}
        {/* 横轴标签 */}
        {labels.map((label, index) => index % stride ? null : (
          <text key={index} x={x(index)} y={HEIGHT - 8} textAnchor="middle">{label}</text>
        ))}
        {/* 各组数据：折线加数据点（面积图再加折线下方的一片），或一组柱子 */}
        {series.map((one, at) => (
          <g key={at} data-series={at % COLOURS}>
            {area ? <polygon points={[...one.values.map((value, index) => `${x(index)},${y(value)}`), `${x(one.values.length - 1)},${y(0)}`, `${x(0)},${y(0)}`].join(' ')} /> : null}
            {bars ? null : <polyline points={one.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />}
            {one.values.map((value, index) => {
              // 鼠标悬停时由浏览器显示的提示。
              const title = <title>{`${labels[index]} · ${one.label}: ${value.toLocaleString(language)}`}</title>
              return bars
                ? <rect key={index} x={x(index) - bar * series.length / 2 + bar * at} width={bar} y={Math.min(y(value), y(0))} height={Math.abs(y(value) - y(0))}>{title}</rect>
                : <circle key={index} cx={x(index)} cy={y(value)} r={Math.min(3, column / 4)}>{title}</circle>
            })}
          </g>
        ))}
      </svg>
      {/* 图例：多于一组数据时才显示 */}
      {series.length > 1
        ? <figcaption>{series.map((one, at) => <span key={at} data-series={at % COLOURS}>{one.label}</span>)}</figcaption>
        : null}
    </figure>
  )
}

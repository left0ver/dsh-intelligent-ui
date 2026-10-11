/** 折线图和柱状图，直接用 SVG 画。 */
import { axis } from './axis.ts'

/** 一组数据：一条折线，或每列里的一根柱子。每个标签对应一个数值。 */
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
const COLOURS = 6

/** 图表。`bars` 为真画柱状图，否则画折线图；`labels` 是横轴上各列的标签。 */
export function Chart({ bars, labels, series }: { bars: boolean; labels: string[]; series: Series[] }) {
  const values = series.flatMap(one => one.values)
  if (!values.length) return null
  // dsh 把当前的语言写在 document 上，数字按这个语言来格式化。
  const language = document.documentElement.lang || undefined
  const compact = new Intl.NumberFormat(language, { notation: 'compact' })
  // 纵轴的刻度。柱子从 0 开始画，所以 0 一定在范围内；折线只显示自身的数值范围。
  const marks = axis(
    values.reduce((low, value) => Math.min(low, value), bars ? 0 : Infinity),
    values.reduce((high, value) => Math.max(high, value), bars ? 0 : -Infinity),
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
        {/* 各组数据：折线加数据点，或一组柱子 */}
        {series.map((one, at) => (
          <g key={at} data-series={at % COLOURS}>
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

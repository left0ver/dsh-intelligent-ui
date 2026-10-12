/**
 * 计算坐标轴上要标出的刻度，范围是 `low` 到 `high`：数量不多、间隔均匀，
 * 步长是 1、2 或 5 乘以 10 的幂。第一个刻度不大于 `low`，最后一个不小于 `high`，
 * 两者一定不相同。
 */
export function axis(low: number, high: number): number[] {
  // 先按分成 4 段估一个步长，再向上取到最近的整齐数值。
  const rough = (high - low) / 4 || 1
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = power * [1, 2, 5, 10].find(factor => factor * power >= rough)!
  const first = Math.floor(low / step)
  return Array.from({ length: Math.max(1, Math.ceil(high / step) - first) + 1 }, (_, index) => (first + index) * step)
}

/** 各个数值占总和的比例，饼图按它分块。负数按 0 算；总和为 0 时全是 0。 */
export function shares(values: number[]): number[] {
  const sizes = values.map(value => Math.max(0, value))
  const total = sizes.reduce((sum, size) => sum + size, 0)
  return sizes.map(size => total ? size / total : 0)
}

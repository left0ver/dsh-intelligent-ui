/**
 * The values to mark on an axis covering `low` to `high`: a few of them, evenly
 * spaced in steps of 1, 2 or 5 times a power of ten. The first is at or
 * below `low` and the last at or above `high`, and they are never the same.
 */
export function axis(low: number, high: number): number[] {
  const rough = (high - low) / 4 || 1
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = power * [1, 2, 5, 10].find(factor => factor * power >= rough)!
  const first = Math.floor(low / step)
  return Array.from({ length: Math.max(1, Math.ceil(high / step) - first) + 1 }, (_, index) => (first + index) * step)
}

/**
 * 程序可以使用的全部元素。右边的说明会原样写进给模型的工具描述里，
 * 所以保持英文；Web 端为其中每个元素都提供了渲染。
 */
export const VOCABULARY = {
  box: 'direction="column|row" gap={0-6} align="start|center|end" justify="start|center|end|between" wrap — layout',
  card: 'title="…" — bordered group',
  title: 'size="sm|md|lg|xl" — heading; its children are the text',
  text: 'tone="muted|good|bad" — paragraph; its children are the text',
  stat: 'label="…" value={…} hint="…" tone="good|bad" — one headline figure',
  slider: 'label="…" value={n} onChange={setN} min={n} max={n} step={n}',
  input: 'label="…" value={s} onChange={setS} type="text|number" placeholder="…"',
  select: 'label="…" value={v} onChange={setV} options={[{label, value}]}',
  checkbox: 'label="…" checked={b} onChange={setB}',
  tabs: 'value={v} onChange={setV} options={[{label, value}]} — tab bar; show each panel with {#if}',
  button: 'onClick={() => …} variant="primary|plain" — its children are the label',
  table: 'columns={[{label, value}]} rows={[{…}]} — `value` names the row field a column shows',
  chart: 'type="line|bar" rows={[{…}]} x="field" series={[{label, value}]} — `x` names the row field labelling each point, each `value` a row field holding numbers',
} as const

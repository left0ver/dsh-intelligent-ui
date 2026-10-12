/**
 * 程序可以使用的全部元素。右边的说明会原样写进给模型的工具描述里，
 * 所以保持英文；Web 端为其中每个元素都提供了渲染。
 */
export const VOCABULARY = {
  box: 'direction="column|row" gap={0-6} align="start|center|end" justify="start|center|end|between" wrap — layout',
  card: 'title="…" — bordered group',
  title: 'size="sm|md|lg|xl" — heading; its children are the text',
  text: 'tone="muted|good|warn|bad" — paragraph; its children are the text',
  stat: 'label="…" value={…} hint="…" tone="good|warn|bad" — one headline figure',
  slider: 'label="…" value={n} onChange={setN} min={n} max={n} step={n}',
  input: 'label="…" value={s} onChange={setS} type="text|number|date|multiline" placeholder="…" — a date is "YYYY-MM-DD"',
  select: 'label="…" value={v} onChange={setV} options={[{label, value}]}',
  checkbox: 'label="…" checked={b} onChange={setB}',
  tabs: 'value={v} onChange={setV} options={[{label, value}]} — tab bar; show each panel with {#if}',
  button: 'onClick={() => …} variant="primary|plain" — its children are the label',
  table: 'columns={[{label, value, align, tone}]} rows={[{…}]} sortable — `value` names the row field a column shows, `tone` the row field holding that cell\'s tone; align is "left|center|right"; `sortable` lets the user sort by clicking a heading',
  chart: 'type="line|bar|area|pie" rows={[{…}]} x="field" series={[{label, value}]} — `x` names the row field labelling each point, each `value` a row field holding numbers; a pie has one slice per row, sized by the first series',
} as const

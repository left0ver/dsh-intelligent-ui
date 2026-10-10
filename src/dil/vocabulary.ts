/** The elements a program may use, as the model reads them. The Web client renders every one. */
export const VOCABULARY = {
  box: 'direction="column|row" gap={0-6} align="start|center|end" justify="start|center|end|between" wrap — layout',
  card: 'title="…" — bordered group',
  title: 'size="sm|md|lg|xl" — heading; its children are the text',
  text: 'tone="muted|good|bad" — paragraph; its children are the text',
  stat: 'label="…" value={…} hint="…" — one headline figure',
  slider: 'label="…" value={n} onChange={setN} min={n} max={n} step={n}',
  input: 'label="…" value={s} onChange={setS} type="text|number" placeholder="…"',
  select: 'label="…" value={v} onChange={setV} options={[{label, value}]}',
  checkbox: 'label="…" checked={b} onChange={setB}',
  tabs: 'value={v} onChange={setV} options={[{label, value}]} — tab bar; show each panel with {#if}',
  button: 'onClick={() => …} variant="primary|plain" — its children are the label',
  table: 'columns={[{label, value}]} rows={[{…}]} — `value` names the row field a column shows',
} as const

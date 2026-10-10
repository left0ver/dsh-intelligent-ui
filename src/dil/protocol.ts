/** What crosses the sandbox boundary. */

/** What a program paints: text, or a tag with resolved props and children. Handlers arrive as `true`. */
export type Item = string | Tag

export interface Tag {
  t: string
  p: Record<string, unknown>
  c: Item[]
}

/** Host → sandbox: run this program, or call the handler `name` of the tag at `path`. */
export type Command =
  | { program: string }
  | { event: { path: number[]; name: string; args: unknown[] } }

/** Sandbox → host. The painted tree travels as JSON. */
export type Report = { ready: true } | { tree: string } | { error: string }

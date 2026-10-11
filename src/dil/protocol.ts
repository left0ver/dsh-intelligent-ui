/** What crosses the sandbox boundary. */

/** What a program paints: text, or a tag with resolved props and children. Handlers arrive as `true`. */
export type Item = string | Tag

export interface Tag {
  t: string
  p: Record<string, unknown>
  c: Item[]
}

/**
 * What a program is called with: the state API, the maker of tags, and the
 * guard its expressions run in. The program's own declarations live in the
 * same scope, so the last two have names no program would choose.
 */
export const PARAMETERS = ['DIL', '$h', '$$'] as const

/** Host → sandbox: run this program, or call the handler `name` of the tag at `path`. */
export type Command =
  | { program: string }
  | { event: { path: number[]; name: string; args: unknown[] } }

/** Sandbox → host. The painted tree travels as JSON. */
export type Report = { ready: true } | { tree: string } | { error: string }

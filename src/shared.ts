/** Vocabulary shared by the host half and the browser half. */

/** Wire name of the tool, and the key the Web client renders its calls under. */
export const TOOL = 'render_ui'

/** Arguments of one `render_ui` call. */
export interface UiArgs {
  title: string
  source: string
}

/**
 * Read the arguments from the raw JSON the model wrote. The JSON may still be
 * streaming, so each field holds whatever has arrived of it.
 */
export function readArgs(json: string): UiArgs {
  return { title: readString(json, 'title'), source: readString(json, 'source') }
}

function readString(json: string, key: string): string {
  const head = new RegExp(`"${key}"\\s*:\\s*"`).exec(json)
  if (head === null) return ''
  // Runs to the closing quote or the end of input, and stops before a half-written escape.
  const body = /^(?:[^"\\]|\\(?:u[0-9a-fA-F]{4}|[^u]))*/.exec(json.slice(head.index + head[0].length))![0]
  return JSON.parse(`"${body}"`) as string
}

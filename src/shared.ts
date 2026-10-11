/** 宿主端和浏览器端共用的定义。 */

/** 工具名：模型按这个名字调用，Web 端也按它找到对应的渲染组件。 */
export const TOOL = 'render_ui'

/** 一次 `render_ui` 调用的参数。 */
export interface UiArgs {
  /** 界面的简短名称。 */
  title: string
  /** 界面的 DIL 源码。 */
  source: string
}

/**
 * 从模型写出的原始 JSON 里读出参数。JSON 可能还在流式输出，
 * 所以每个字段只包含目前已经到达的部分。
 */
export function readArgs(json: string): UiArgs {
  return { title: readString(json, 'title'), source: readString(json, 'source') }
}

/** 读出 `key` 对应的字符串值：值还没写完时返回已有的部分，字段还没出现时返回空串。 */
function readString(json: string, key: string): string {
  const head = new RegExp(`"${key}"\\s*:\\s*"`).exec(json)
  if (head === null) return ''
  // 读到结束引号或输入末尾为止，遇到写了一半的转义序列就停在它前面。
  const body = /^(?:[^"\\]|\\(?:u[0-9a-fA-F]{4}|[^u]))*/.exec(json.slice(head.index + head[0].length))![0]
  return JSON.parse(`"${body}"`) as string
}

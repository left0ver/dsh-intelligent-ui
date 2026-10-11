/** 沙箱内外之间传递的数据。 */

/** 程序渲染出的一项：一段文本，或一个标签。 */
export type Item = string | Tag

export interface Tag {
  /** 标签名。 */
  t: string
  /** 已经求值的属性；事件处理函数传到沙箱外时变成 `true`。 */
  p: Record<string, unknown>
  /** 子项。 */
  c: Item[]
}

/**
 * 程序的三个参数：状态 API、创建标签的函数、保护表达式求值的函数。
 * 程序自己声明的变量和它们在同一个作用域里，所以后两个用了模型不会用到的名字。
 */
export const PARAMETERS = ['DIL', '$h', '$$'] as const

/** 页面 → 沙箱：运行这段程序，或者调用 `path` 位置上那个标签的 `name` 事件处理函数。 */
export type Command =
  | { program: string }
  | { event: { path: number[]; name: string; args: unknown[] } }

/** 沙箱 → 页面：Worker 已就绪、渲染出的界面树（JSON 字符串），或出错信息。 */
export type Report = { ready: true } | { tree: string } | { error: string }

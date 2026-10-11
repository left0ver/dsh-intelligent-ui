/** 插件自己显示的文案，dsh 支持的语言各一份。 */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export const en = {
  /** 工具调用行里，被宿主端打回的那次调用。 */
  refused: '{title} — has errors',
  /** 程序无法运行时，显示在界面位置上的说明。 */
  unshown: '{title} could not be displayed.',
}

export const zh: typeof en = {
  refused: '{title} — 有错误',
  unshown: '{title} 无法显示。',
}

// 把本插件的文案键登记到 dsh 的类型里，`t()` 才能检查键名。
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'intelligent-ui': keyof typeof en
  }
}

/** 翻译函数：既能翻译上面的键，也能翻译 dsh 的公共词条。 */
export type Translate = TranslateNS<'intelligent-ui'>

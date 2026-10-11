/** The words this plugin shows of its own, in the languages dsh ships. */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export const en = {
  /** A call the host turned down, in its tool row. */
  refused: '{title} — has errors',
  /** In place of an interface whose program cannot run. */
  unshown: '{title} could not be displayed.',
}

export const zh: typeof en = {
  refused: '{title} — 有错误',
  unshown: '{title} 无法显示。',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'intelligent-ui': keyof typeof en
  }
}

/** Translates the keys above and the vocabulary dsh shares. */
export type Translate = TranslateNS<'intelligent-ui'>

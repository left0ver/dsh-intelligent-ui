/** 构建时以字符串形式内联进来的文件。 */

declare module '*.css' {
  const text: string
  export default text
}

declare module '*.dil' {
  const text: string
  export default text
}

/** 打包好的沙箱 Worker 脚本，由 `build.mjs` 注入。 */
declare const __WORKER__: string

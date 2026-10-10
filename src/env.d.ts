/** Inputs the build turns into strings. */

declare module '*.css' {
  const text: string
  export default text
}

declare module '*.dil' {
  const text: string
  export default text
}

/** The bundled sandbox worker script. */
declare const __WORKER__: string

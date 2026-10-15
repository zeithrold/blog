declare module 'cloudflare:workers' {
  export const env: import('./server/environment').Environment
}
declare module 'virtual:vinext-rsc-entry' {
  function ensureInstrumentation(): Promise<void>
  export { ensureInstrumentation as __ensureInstrumentation }
}
declare const FixedLengthStream: typeof import('@cloudflare/workers-types/index.ts').FixedLengthStream
declare module '*?worker&url' {
  const url: string
  export default url
}

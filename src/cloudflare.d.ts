declare module 'cloudflare:workers' {
  export const env: import('./server/runtime/environment').Environment
}
declare module 'virtual:vinext-rsc-entry' {
  function ensureInstrumentation(): Promise<void>
  export { ensureInstrumentation as __ensureInstrumentation }
}
declare const FixedLengthStream: typeof import('@cloudflare/workers-types/index.ts').FixedLengthStream
declare class HTMLRewriter {
  on(
    selector: string,
    handlers: import('@cloudflare/workers-types/index.ts').HTMLRewriterElementContentHandlers,
  ): HTMLRewriter
  transform(response: Response): Response
}
declare module '*?worker&url' {
  const url: string
  export default url
}

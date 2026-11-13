declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: { readonly contentType: string })
    readonly window: { readonly document: Document }
  }
}

import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import type { Publication } from '@/features/reader/reader-header'
import { Blocks } from '@/features/reader/blocks'
import { readerContext } from '@/features/reader/context'
import { ReaderHeader } from '@/features/reader/reader-header'
import { ReaderNavigation } from '@/features/reader/reader-navigation'
import { Bibliography, Notes } from '@/features/reader/references'

const utility1Class = ['reader-body font-serif text-reading [&_>_:first-child]:mt-0 [&_p]:mt-0 [&_p]:mx-0'].join(' ')

const utility2Class = [
  '[&_p]:mb-[1.1em] [&_h2]:font-semibold [&_h2]:tracking-[-0.015em] [&_h3]:font-semibold',
].join(' ')

const utility3Class = [
  '[&_h3]:tracking-[-0.015em] [&_h4]:font-semibold [&_h4]:tracking-[-0.015em] [&_h2]:mt-[2.2em]',
].join(' ')

const utility4Class = [
  '[&_h2]:mx-0 [&_h2]:mb-[0.7em] [&_h2]:text-[length:1.75em] [&_h3]:mt-[1.9em] [&_h3]:mx-0',
].join(' ')

const utility5Class = [
  '[&_h3]:mb-[0.6em] [&_h3]:text-[length:1.4em] [&_h4]:mt-[1.6em] [&_h4]:mx-0 [&_h4]:mb-[0.5em]',
].join(' ')

const utility6Class = [
  '[&_sup_a]:no-underline [&_ul]:mt-0 [&_ul]:mx-0 [&_ul]:mb-[1.1em] [&_ul:not(.task-list)]:pl-[1.4em]',
  '[&_ol]:mt-0',
].join(' ')

const utility7Class = ['[&_li::marker]:text-muted-foreground [&_li_>_p]:m-0 [&_:not(pre)_>_code]:py-[0.15em]'].join(' ')

const utility8Class = [
  '[&_:not(pre)_>_code]:px-[0.4em] [&_:not(pre)_>_code]:rounded-[5px]',
  '[&_:not(pre)_>_code]:bg-muted',
].join(' ')

const utility9Class = ['[&_:not(pre)_>_code]:font-mono [&_:not(pre)_>_code]:text-[length:0.86em]'].join(' ')

const utility10Class = [
  '[&_pre]:my-[1.6em] [&_pre]:mx-0 [&_pre]:py-[18px] [&_pre]:px-5 [&_pre]:overflow-x-auto',
].join(' ')

const utility11Class = [
  '[&_blockquote]:pt-[2px] [&_blockquote]:pr-0 [&_blockquote]:pb-[2px] [&_blockquote]:pl-5',
].join(' ')

const utility12Class = [
  '[&_blockquote]:text-muted-foreground [&_hr]:my-[3em] [&_hr]:mx-0 [&_hr]:border-0',
  '[&_hr]:border-t',
].join(' ')

const utility13Class = [
  '[&_hr]:border-border [&_details]:my-[1em] [&_details]:mx-0 [&_details]:py-[2px]',
  '[&_details]:px-4',
].join(' ')

const utility14Class = [
  '[&_details]:border [&_details]:border-border [&_details]:rounded-[12px] [&_details]:bg-card',
].join(' ')

const utility15Class = ['[&_details[open]]:pb-3 [&_.link-card_a]:font-medium [&_.link-card_a]:no-underline'].join(' ')

const utility16Class = [
  '[&_.link-card_p]:text-muted-foreground [&_.link-card_p]:text-help',
  '[&_.link-card_p]:leading-[1.7]',
].join(' ')

const utility17Class = [
  '[&_.table-of-contents_a]:no-underline [&_>_section]:mt-[3em] [&_>_section]:pt-[1.5em]',
].join(' ')

const utility18Class = [
  '[&_>_section]:border-t [&_>_section]:border-border [&_>_section]:text-muted-foreground',
].join(' ')

const utility19Class = [
  '[&_>_section]:text-[length:15px] [&_>_section_h2]:mt-0 [&_>_section_h2]:mx-0',
  '[&_>_section_h2]:mb-3',
].join(' ')

const utility20Class = [
  '[&_>_section_h2]:text-muted-foreground [&_>_section_h2]:text-help [&_>_section_h2]:font-medium',
].join(' ')

const utility21Class = [
  '[&_>_section_h2]:tracking-[0.14em] [&_>_section_h2]:uppercase [&_.table-of-contents_h2]:m-0',
].join(' ')

const utility22Class = ['[&_.table-of-contents_h2]:text-[length:15px] [&_.table-of-contents_h2]:tracking-[0]'].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  '[&_h4]:text-[length:1.2em] [&_:is(h2,h3,h4)]:font-sans [&_:is(h2,h3,h4)]:leading-[1.35]',
  '[&_a]:[text-decoration-color:color-mix(in_srgb,_var(--ztd-accent)_55%,_transparent)]',
  '[&_a]:[text-decoration-thickness:1px] [&_a]:underline-offset-[0.22em]',
  '[&_a]:[transition:text-decoration-color_0.15s] [&_sup_a]:text-accent-foreground',
  utility6Class,
  '[&_ul:not(.task-list)]:list-disc [&_ol]:list-decimal',
  '[&_ol]:mx-0 [&_ol]:mb-[1.1em] [&_ol]:pl-[1.4em] [&_li]:my-[0.3em] [&_li]:mx-0',
  utility7Class,
  utility8Class,
  utility9Class,
  utility10Class,
  '[&_pre]:border [&_pre]:border-border [&_pre]:rounded-[12px] [&_pre]:bg-card',
  '[&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-[1.7]',
  '[&_pre]:[overflow-wrap:normal] [&_blockquote]:my-[1.6em] [&_blockquote]:mx-0',
  utility11Class,
  '[&_blockquote]:border-l-[3px] [&_blockquote]:border-accent-foreground',
  utility12Class,
  utility13Class,
  utility14Class,
  utility15Class,
  '[&_.link-card_p]:mt-1 [&_.link-card_p]:mx-0 [&_.link-card_p]:mb-0',
  utility16Class,
  '[&_.table-of-contents_li]:m-0 [&_.table-of-contents_a]:inline-block',
  '[&_.table-of-contents_a]:min-h-11 [&_.table-of-contents_a]:py-2',
  utility17Class,
  utility18Class,
  utility19Class,
  utility20Class,
  utility21Class,
  utility22Class,
  '[&_a:hover]:[text-decoration-color:var(--ztd-accent)]',
].join(' ')

export function DocumentReader({
  document,
  privatePreview = false,
  publication,
}: {
  document: Document
  privatePreview?: boolean
  publication?: Publication
}): ReactNode {
  const context = readerContext(document, privatePreview)
  return (
    <ReaderNavigation language={document.meta.documentLocale}>
      {document.meta.seo.noindex && <meta name="robots" content="noindex, nofollow" />}
      <ReaderHeader meta={document.meta} publication={publication} />
      <div className={layout1Class}>
        <Blocks blocks={document.blocks} context={context} />
        <Notes context={context} />
        <Bibliography context={context} />
      </div>
    </ReaderNavigation>
  )
}

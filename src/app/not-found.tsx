import { ArrowLeft } from 'lucide-react'
import { PublicPageTitle } from '@/features/reader/public-page-title'
import { SiteText } from '@/i18n/site-text'

const utility1Class = ['[&_>_p:not(.eyebrow)]:my-6', '[&_>_p:not(.eyebrow)]:mx-0'].join(' ')

const utility2Class = ['[&_>_p:not(.eyebrow)]:text-muted-foreground [&_>_p:not(.eyebrow)]:text-[length:15px]'].join(' ')

const utility3Class = [
  '[&_>_p:not(.eyebrow)]:leading-[1.85] [&_>_a]:inline-flex [&_>_a]:items-center',
  '[&_>_a]:gap-[10px]',
].join(' ')

const utility4Class = [
  'eyebrow m-0 text-muted-foreground text-help font-medium tracking-[0.14em] leading-[1.6]',
].join(' ')

const layout1Class = [
  'site-content w-[min(var(--blog-content-width),_calc(100%_-_96px))] my-0 mx-auto',
  'max-[960px]:w-[calc(100%_-_64px)] max-[701px]:w-[calc(100%_-_40px)]',
  'max-[360px]:w-[calc(100%_-_32px)]',
].join(' ')

const layout2Class = [
  'not-found pt-24 px-0 pb-30 [&_h1]:max-w-150 [&_h1]:mt-4',
  utility1Class,
  utility2Class,
  utility3Class,
  '[&_>_a]:min-h-11 [&_>_a]:text-help [&_>_a]:font-medium [&_>_a]:no-underline',
  '[&_>_a:hover]:text-accent-foreground',
].join(' ')

export default function NotFound(): React.ReactNode {
  return (
    <div className={layout1Class}>
      <section className={layout2Class} aria-labelledby="not-found-heading">
        <p className={[utility4Class, 'uppercase'].join(' ')}>
          404
        </p>
        <PublicPageTitle variant="utility" id="not-found-heading"><SiteText value="Not found" /></PublicPageTitle>
        <p><SiteText value="This page is unavailable." /></p>
        <a href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          <SiteText value="Return to the blog" />
        </a>
      </section>
    </div>
  )
}

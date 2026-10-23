import { ArrowUpRight, FileText, Scale } from 'lucide-react'
import { PublicPageTitle } from '@/features/reader/public-page-title'
import { SiteText } from '@/i18n/site-text'

const utility1Class = [
  'page-intro max-w-190 pt-14 px-0 pb-11 [&_.back-link]:mt-0 [&_.back-link]:mr-0',
  '[&_.back-link]:mb-5',
].join(' ')

const utility2Class = ['[&_.back-link]:ml-[-2px]'].join(' ')

const utility3Class = [
  'eyebrow intro-eyebrow m-0 text-muted-foreground text-help font-medium tracking-[0.14em]',
].join(' ')

const utility4Class = [
  'link-list my-6 mx-0 p-0 overflow-hidden border-y border-border list-none text-control',
].join(' ')

const utility5Class = [
  '[&_li_+_li]:border-t [&_li_+_li]:border-border [&_a]:flex [&_a]:items-center [&_a]:gap-[14px]',
].join(' ')

const utility6Class = [
  '[&_a]:min-h-13 [&_a]:py-3 [&_a]:px-[18px] [&_a]:no-underline [&_svg]:text-muted-foreground',
].join(' ')

const utility7Class = [
  '[&_.link-list-arrow]:ml-auto [&_.link-list-arrow]:text-accent-foreground [&_a:hover]:bg-muted',
].join(' ')

const utility8Class = ['page-lead mt-[18px] mx-0 mb-0 text-muted-foreground text-[length:15px] leading-[1.8]'].join(' ')

const layout1Class = [
  'site-content w-[min(var(--blog-content-width),_calc(100%_-_96px))] my-0 mx-auto',
  'max-[960px]:w-[calc(100%_-_64px)] max-[701px]:w-[calc(100%_-_40px)]',
  'max-[360px]:w-[calc(100%_-_32px)]',
].join(' ')

const layout2Class = [
  utility1Class,
  utility2Class,
  'max-[701px]:pt-10 max-[701px]:px-0 max-[701px]:pb-8',
].join(' ')

const layout3Class = [
  utility3Class,
  'leading-[1.6] uppercase flex items-center gap-[10px] mt-0 mx-0 mb-[22px]',
].join(' ')

const layout5Class = [
  utility4Class,
  utility5Class,
  utility6Class,
  utility7Class,
].join(' ')

const sources = [
  {
    href: '/licenses/third-party-notices.txt',
    label: 'Complete original license and copyright notices',
  },
  {
    href: '/licenses/sbom.json',
    label: 'Dependency and bundled-module inventory snapshot',
  },
  {
    href: 'https://github.com/kieler/elkjs/tree/a8304cf79fde75bc2ab1a89d28320f53f8637436',
    label: 'ELK.js 0.9.3 source and build instructions (EPL 2.0)',
  },
  {
    href: 'https://github.com/eclipse/elk',
    label: 'Eclipse Layout Kernel Java source repository',
  },
  {
    href: 'https://registry.npmjs.org/@blocknote/core/-/core-0.55.0.tgz',
    label: 'Corresponding core source',
  },
  {
    href: 'https://registry.npmjs.org/@blocknote/react/-/react-0.55.0.tgz',
    label: 'Corresponding React source',
  },
  {
    href: 'https://www.mozilla.org/en-US/MPL/2.0/',
    label: 'MPL 2.0 license',
  },
  {
    href: 'https://github.com/zeithrold/tools/tree/6f1ab6f1e820b7e498c95c11bed7bdd81378eb46/packages/ui',
    label: 'Shared UI source and notices',
  },
]

export default function Licenses(): React.ReactNode {
  return (
    <div className={layout1Class}>
      <section className={layout2Class} aria-labelledby="licenses-heading">
        <p className={layout3Class}>
          <Scale className="intro-mark text-accent-foreground" size={16} aria-hidden="true" />
          <SiteText value="Licenses" />
        </p>
        <PublicPageTitle variant="utility" id="licenses-heading">
          <SiteText value="Third-party licenses" />
        </PublicPageTitle>
        <p className={utility8Class}>
          <SiteText value="Open source notices and corresponding sources for the code this site ships." />
        </p>
      </section>
      <section className="license-content max-w-190 pb-18 text-body leading-[1.8]" lang="en">
        <p>
          BlockNote core and React 0.55.0 are licensed under MPL 2.0. These packages are used
          without source modifications.
        </p>
        <ul className={layout5Class}>
          {sources.map(source => (
            <li key={source.href}>
              <a href={source.href}>
                <FileText size={16} aria-hidden="true" />
                <span>{source.label}</span>
                <ArrowUpRight className="link-list-arrow" size={15} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="muted text-muted-foreground">
          Noto fonts use the SIL Open Font License. React, Radix, Lucide, vinext, Zod and jose
          have their original third-party licenses. The inventory is a retained snapshot from a
          previous build and is not regenerated automatically. Dependency changes require updates
          to the corresponding notices and inventory.
        </p>
      </section>
    </div>
  )
}

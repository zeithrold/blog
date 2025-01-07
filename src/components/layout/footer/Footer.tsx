import FooterContent from './FooterContent.mdx'

export default function Footer() {
  return (
    <div
      className={`
        mt-8 flex max-w-full flex-col items-center gap-2 bg-slate-100 py-4
        text-sm
      `}
    >
      <FooterContent />
    </div>
  )
}

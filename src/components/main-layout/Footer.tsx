import FooterText from './FooterText.mdx'

export default function Footer() {
  return (
    <footer class={`
      prose prose-sm absolute bottom-0 -z-10 flex w-full max-w-none flex-col
      items-center justify-center bg-gray-50 p-4

      prose-p:mb-1 prose-p:mt-1
    `}
    >
      <FooterText />
    </footer>
  )
}

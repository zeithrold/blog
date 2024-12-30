import type { JSX } from 'solid-js/jsx-runtime'
import Footer from '@/components/main-layout/Footer'
import Header from '@/components/main-layout/Header'

export default function RootLayout(props: {
  children: JSX.Element
}) {
  return (
    <div class="relative flex min-h-[100vh] flex-col noto-sans">
      <Header />
      {props.children}
      <Footer />
    </div>
  )
}

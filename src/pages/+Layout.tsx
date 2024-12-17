import type { JSX } from 'solid-js/jsx-runtime'
import { attachDevtoolsOverlay } from '@solid-devtools/overlay'
import './tailwind.css'
import 'solid-devtools'

attachDevtoolsOverlay()

export default function Layout(props: { children?: JSX.Element }) {
  return (
    <div class="flex">
      {props.children}
    </div>
  )
}

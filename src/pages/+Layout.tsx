import type { JSX } from 'solid-js/jsx-runtime'
import '~/style.css'

export default function (props: { children: JSX.Element }) {
  return (
    <>
      {props.children}
    </>
  )
}

import { Show } from 'solid-js'
import { usePageContext } from 'vike-solid/usePageContext'

export default function Page() {
  const { is404, errorWhileRendering } = usePageContext()

  return (
    <Show
      when={is404}
      fallback={(
        <div>
          <h1>500</h1>
          <pre>{`${errorWhileRendering}`}</pre>
        </div>
      )}
    >
      <h1>404</h1>
    </Show>

  )
}

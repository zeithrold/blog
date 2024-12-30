import { usePageContext } from 'vike-solid/usePageContext'

export default function IndexPage() {
  const { method } = usePageContext()
  return (
    <div>
      <h1 class="text-2xl font-bold">
        Hello, world!,
        {' '}
        {method}
      </h1>
      <button type="button" class="btn btn-primary">
        Hello, world!
      </button>
    </div>
  )
}

import Card from '@/components/error/Card'
import { usePageContext } from 'vike-solid/usePageContext'

export default function Page() {
  const { abortStatusCode, is404 } = usePageContext()
  const errorCode
    = is404
      ? 404
      // eslint-disable-next-line ts/strict-boolean-expressions
      : abortStatusCode || 500
  return (
    <Card errorCode={errorCode} />
  )
}

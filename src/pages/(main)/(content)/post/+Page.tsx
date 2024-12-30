import type { Data } from './+data'
import { useData } from 'vike-solid/useData'

export default function SimplePage() {
  const { slug } = useData<Data>()
  return (
    <div>
      <h1>{slug}</h1>
    </div>
  )
}

import Advanced from './Advanced'
import SearchBox from './SearchBox'

export default function Card() {
  return (
    <form
      class={`
        flex w-full flex-col rounded-lg border-2 border-solid border-base-200
        bg-base-100 p-4

        md:w-1/2
      `}
    >
      <SearchBox />
      <Advanced />
    </form>
  )
}

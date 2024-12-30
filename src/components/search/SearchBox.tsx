import { BiRegularDotsHorizontalRounded, BiRegularSearch } from 'solid-icons/bi'
import { advancedSearch, setAdvancedSearch } from './signals'

function SearchIcon() {
  return <BiRegularSearch class="text-xl text-gray-400" />
}

export default function SearchBox() {
  return (
    <label class="input input-bordered flex items-center gap-2">
      <SearchIcon />
      <input
        type="text"
        name="q"
        class="grow"
        placeholder="Search..."
      />
      <button
        type="button"
        onClick={() => setAdvancedSearch(!advancedSearch())}
        class="btn btn-square btn-ghost btn-sm"
      >
        <BiRegularDotsHorizontalRounded
          class="text-xl text-gray-400 transition-transform ease-in-out"
          classList={{
            'rotate-90': advancedSearch(),
          }}
        />
      </button>
    </label>
  )
}

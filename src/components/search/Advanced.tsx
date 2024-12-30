import type { JSX } from 'solid-js/jsx-runtime'
import { BiRegularPurchaseTag, BiRegularUser } from 'solid-icons/bi'
import { advancedSearch } from './signals'

function TagIcon() {
  return <BiRegularPurchaseTag class="text-xl text-gray-400" />
}

function AuthorIcon() {
  return <BiRegularUser class="text-xl text-gray-400" />
}

interface TextInputProps {
  name: string
  icon: JSX.Element
  placeholder: string
}

function TextInput(props: TextInputProps) {
  return (
    <label
      class="input input-sm input-bordered m-2 flex w-full items-center gap-2"
    >
      {props.icon}
      <input
        disabled={!advancedSearch()}
        type="text"
        name={props.name}
        class="grow"
        placeholder={props.placeholder}
      />
    </label>
  )
}

export default function Advanced() {
  return (
    <div
      class={`
        flex h-0 w-full flex-col overflow-hidden transition-all ease-in-out
      `}
      classList={{
        'h-36 mt-4': advancedSearch(),
      }}
    >
      <h2 class="font-semibold text-gray-600">Advanced Search...</h2>
      <div class="flex flex-1 flex-col items-center justify-center p-1">
        <TextInput
          name="tag"
          icon={<TagIcon />}
          placeholder="Tag"
        />
        <TextInput
          name="author"
          icon={<AuthorIcon />}
          placeholder="Author"
        />
      </div>
    </div>
  )
}

import { BiLogosGithub } from 'solid-icons/bi'

export default function Card() {
  return (
    <form
      class={`
        flex w-full flex-col rounded-lg border-2 border-solid border-base-200
        bg-base-100 p-4

        md:w-1/2
      `}
      action="/v1/api/auth/github"
    >
      <label class="btn btn-outline flex items-center justify-center">
        <BiLogosGithub class="text-xl" />
        <button>Login With GitHub</button>
      </label>
    </form>
  )
}

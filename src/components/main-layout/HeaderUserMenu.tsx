import type { ClientType } from '@/routes/api/auth'
import { client } from '@/routes/api/client'
import { BiRegularLoaderAlt, BiRegularLock, BiRegularUserCircle } from 'solid-icons/bi'
import { createResource, Match, Switch } from 'solid-js'

const AuthClient = client<ClientType>('/auth')

async function getSession() {
  return (await AuthClient.whoami.$get()).json()
}

function LoadingIcon() {
  return <BiRegularLoaderAlt class="animate-spin text-xl" />
}

function LoginIcon() {
  return <BiRegularLock class="text-xl" />
}

function UserIcon() {
  return <BiRegularUserCircle class="text-xl" />
}

export default function HeaderUserMenu() {
  const [data] = createResource(getSession)
  return (
    <Switch>
      <Match when={data.loading}>
        <button type="button" class="btn btn-square btn-ghost text-xl">
          <LoadingIcon />
        </button>
      </Match>
      <Match when={!data.loading && data()?.data}>
        <button type="button" class="btn btn-square btn-ghost text-xl">
          <UserIcon />
        </button>
      </Match>
      <Match when={true}>
        <button type="button" class="btn btn-square btn-ghost text-xl">
          <LoginIcon />
        </button>
      </Match>
    </Switch>
  )
}

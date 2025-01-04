import trpc from '@/lib/trpc'
import { BiRegularErrorCircle, BiRegularLoaderAlt, BiRegularLock, BiRegularUserCircle } from 'solid-icons/bi'
import { createResource, Match, Switch } from 'solid-js'

async function getCurrentUser() {
  return trpc.auth.whoami.query()
}

function ErrorIcon() {
  return <BiRegularErrorCircle class="text-xl" />
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
  const [data] = createResource(getCurrentUser)
  return (
    <button type="button" class="btn btn-square btn-ghost text-xl">
      <Switch>
        <Match when={data.state === 'ready' && data() !== null}>
          <UserIcon />
        </Match>
        <Match when={data.state === 'errored'}>
          <ErrorIcon />
        </Match>
        <Match when={data.state === 'ready' && data() === null}>
          <LoginIcon />
        </Match>
        <Match when={true}>
          <LoadingIcon />
        </Match>
      </Switch>
    </button>
  )
}

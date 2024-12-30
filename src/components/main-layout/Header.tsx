import { BiRegularSearch } from 'solid-icons/bi'
import { clientOnly } from 'vike-solid/clientOnly'
import Drawer from './Drawer'

const HeaderUserMenu = clientOnly(async () => import('./HeaderUserMenu'))

export default function Header() {
  return (
    <header class="navbar bg-base-100">
      <div class={`
        flex-none

        md:hidden
      `}
      >
        <Drawer />
      </div>
      <div class="flex-1">
        <a href="/" class="btn btn-ghost text-xl">Zeithrold's Blog</a>
      </div>
      <div class="flex-none">
        <HeaderUserMenu />
        <a href="/search" class="btn btn-square btn-ghost text-xl">
          <BiRegularSearch />
        </a>
      </div>
    </header>
  )
}

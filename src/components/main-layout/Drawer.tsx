import { BiRegularMenu } from 'solid-icons/bi'

export default function Drawer() {
  return (
    <div class="drawer">
      <input type="checkbox" id="navbar-drawer" class="drawer-toggle" />
      <div class="drawer-content">
        <label for="navbar-drawer" class="btn btn-square btn-ghost">
          <BiRegularMenu class="text-xl" />
        </label>
      </div>
      <div class="drawer-side">
        <label
          for="navbar-drawer"
          aria-label="close sidebar"
          class="drawer-overlay"
        />
        <ul class="menu min-h-full w-80 bg-base-200 p-4 text-base-content">
          {/* <!-- Sidebar content here --> */}
          <li><a>Sidebar Item 1</a></li>
          <li><a>Sidebar Item 2</a></li>
        </ul>
      </div>
    </div>
  )
}

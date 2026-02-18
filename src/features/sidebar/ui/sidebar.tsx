import { useSidebar } from '../lib/hooks/use-sidebar'

export const Sidebar = () => {
  const { navigationItems, activeItem, handleSelectItem } = useSidebar()

  return (
    <aside className="w-[412px] shrink-0 pl-15 py-10 pr-5">
      <nav>
        <ul className="flex flex-col">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem?.id === item.id

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectItem(item.id)
                  }}
                  className={`flex w-full items-center gap-4 rounded-lg px-4 py-3 text-left text-base text-ui-01 transition-colors ${isActive ? 'bg-ui-01 text-ui-06' : 'hover:bg-ui-01/10'}`}
                >
                  <Icon className="size-8 shrink-0" />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

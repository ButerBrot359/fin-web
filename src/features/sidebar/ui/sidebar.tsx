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
                  className={`flex w-full justify-start max-h-14 items-center gap-3 rounded-lg pl-4 py-2 text-left text-base text-ui-01 transition-colors ${isActive ? 'bg-ui-01 text-ui-06' : 'hover:bg-ui-01/10'}`}
                >
                  <div
                    className={`flex justify-center min-w-10 min-h-10 rounded-lg items-center ${isActive ? 'bg-accent-01' : 'bg-ui-06'}`}
                  >
                    <Icon
                      className={`w-6 h-6 shrink-0 ${isActive ? 'text-ui-06' : 'text-ui-01'}`}
                    />
                  </div>
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

import type { ReactNode } from 'react'

import { WorkspacePanelHost } from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { WorkspaceTabBar } from '@/widgets/workspace-tab-bar'

interface LayoutProps {
  sidebar: ReactNode
  header?: ReactNode
  children?: ReactNode
}

export const Layout = ({ sidebar, header, children }: LayoutProps) => {
  // panelId активной вкладки типа 'sdui-panel'; undefined — обычная вкладка/нет вкладок
  const activePanelId = useWorkspaceTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab?.pageType === 'sdui-panel' ? tab.panelId : undefined
  })

  return (
    <div className="flex h-screen w-full bg-ui-06">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-4xl rounded-bl-4xl bg-ui-02 p-8 pb-0">
        <header>{header}</header>
        <main className="min-h-0 flex-1 overflow-auto">
          {/* Роут-контент прячем классом, НЕ размонтируем: форма документа
              под панельной вкладкой должна пережить переключение (спека §2.4) */}
          <div className={activePanelId ? 'hidden' : 'h-full'}>{children}</div>
          {activePanelId && <WorkspacePanelHost panelId={activePanelId} />}
        </main>
        <WorkspaceTabBar />
      </div>
    </div>
  )
}

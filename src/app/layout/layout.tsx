import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { WorkspacePanelHost } from '@/features/sdui'
import { performTabClose, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { WorkspaceTabBar } from '@/widgets/workspace-tab-bar'

interface LayoutProps {
  sidebar: ReactNode
  header?: ReactNode
  children?: ReactNode
}

export const Layout = ({ sidebar, header, children }: LayoutProps) => {
  const navigate = useNavigate()
  // Активная вкладка типа 'sdui-panel'; undefined — обычная вкладка/нет вкладок
  const activePanelTab = useWorkspaceTabsStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId)
    return tab?.pageType === 'sdui-panel' ? tab : undefined
  })

  const handleClosePanelTab = () => {
    if (activePanelTab) performTabClose(activePanelTab.id, navigate)
  }

  return (
    <div className="flex h-screen w-full bg-ui-06">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-4xl rounded-bl-4xl bg-ui-02 p-8 pb-0">
        <header>{header}</header>
        <main className="min-h-0 flex-1 overflow-auto">
          {/* Роут-контент прячем классом, НЕ размонтируем: форма документа
              под панельной вкладкой должна пережить переключение (спека §2.4) */}
          <div className={activePanelTab ? 'hidden' : 'h-full'}>{children}</div>
          {activePanelTab?.panelId && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Chrome панельной вкладки (баг #2): заголовок = props.title
                  от бэка («Движения документа: {название}»), «назад» и
                  крестик закрывают вкладку — роут под панелью не менялся,
                  navigate(-1) тут не годится. */}
              <PageHeader
                title={activePanelTab.title}
                onBack={handleClosePanelTab}
                onClose={handleClosePanelTab}
              />
              <div className="min-h-0 flex-1 overflow-auto">
                <WorkspacePanelHost panelId={activePanelTab.panelId} />
              </div>
            </div>
          )}
        </main>
        <WorkspaceTabBar />
      </div>
    </div>
  )
}

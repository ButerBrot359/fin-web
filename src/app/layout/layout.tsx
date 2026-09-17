import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { BackgroundStatusBar } from '@/features/background-tasks'
import { WorkspacePanelHost } from '@/features/sdui'
import { AiAssistantWidget } from '@/features/ai-assistant'
import { SupportCallWidget } from '@/features/support-call'
import {
  performTabBack,
  performTabClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
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

  // «Назад» — на вкладку-опенер (панель остаётся в баре); «✕» — закрыть
  const handleBackPanelTab = () => {
    if (activePanelTab) performTabBack(activePanelTab.id, navigate)
  }

  return (
    // h-full, не h-screen: высота приходит цепочкой html→body→#root (100%),
    // и при пер-пользовательском масштабе компенсацию делает #root — 100vh
    // здесь снова ломал бы её (полоса фона снизу при 90%).
    <div className="flex h-full w-full bg-ui-06">
      {sidebar}
      {/* Карта контента скруглена только сверху-слева (Figma 150:4094);
          нижнего скругления в макете нет — тёмный «язык» слева внизу убран. */}
      <div className="flex min-w-0 flex-1 flex-col rounded-tl-4xl bg-ui-02 p-8 pb-0">
        <header>{header}</header>
        <main className="min-h-0 flex-1 overflow-auto">
          {/* Роут-контент прячем классом, НЕ размонтируем: форма документа
              под панельной вкладкой должна пережить переключение (спека §2.4) */}
          <div className={activePanelTab ? 'hidden' : 'h-full'}>{children}</div>
          {activePanelTab?.panelId && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Chrome панельной вкладки (баг #2): заголовок = props.title
                  от бэка («Движения документа: {название}»), «назад» возвращает
                  на вкладку-опенер (панель остаётся в баре), крестик закрывает
                  вкладку — роут под панелью не менялся, navigate(-1) тут не годится. */}
              <PageHeader
                title={activePanelTab.title}
                onBack={handleBackPanelTab}
                onClose={handleClosePanelTab}
              />
              <div className="min-h-0 flex-1 overflow-auto">
                <WorkspacePanelHost panelId={activePanelTab.panelId} />
              </div>
            </div>
          )}
        </main>
        {/* SCRUM-317 канал №6: строка состояния над фоновыми операциями */}
        <BackgroundStatusBar />
        <WorkspaceTabBar />
      </div>
      {/* Живая поддержка (ADR-0050): доступна с любой страницы. */}
      <SupportCallWidget />

      {/* ИИ-помощник (концепция «AI-помощник в 1С»): постоянная кнопка доступна
          с любой страницы, панель открывается поверх формы и её не перестраивает.
          Стоит НАД кнопкой поддержки — правый нижний угол во время звонка
          занимает панель звонка. */}
      <AiAssistantWidget />
    </div>
  )
}

import { Suspense, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useModule } from '@/entities/module'
import { SduiScreen, mapKindToPageType } from '@/features/sdui'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { ModuleToolbar } from '@/widgets/module-toolbar'

import { ModuleNavList } from './module-nav-list'
import { usePageTitle } from '../lib/hooks/use-page-title'
import { ModuleNavSkeleton } from './module-nav-skeleton'
import { useReadyReportsSection } from '../lib/hooks/use-ready-reports-section'

export const ModulePage = () => {
  const { pageCode = '' } = useParams<{ pageCode: string }>()

  // Роут-компонент переиспользуется при смене только :pageCode. Фолбэк на
  // старый бэк должен быть ограничен одним модулем, а не тянуться на следующий.
  return <ModulePageContent key={pageCode} />
}

const ModulePageContent = () => {
  const [useLegacyPage, setUseLegacyPage] = useState(false)

  if (useLegacyPage) return <LegacyModulePage />

  return (
    <ServerDrivenModulePage
      onOpenFailed={() => {
        setUseLegacyPage(true)
      }}
    />
  )
}

// SDUI-first приёмник (SCRUM-181): route-only OPEN, дерево и заголовок вкладки
// целиком серверные. Никаких запросов настроек модуля на клиенте.
const ServerDrivenModulePage = ({
  onOpenFailed,
}: {
  onOpenFailed: () => void
}) => {
  const location = useLocation()

  return (
    <SduiScreen
      onTab={(tab) => {
        if (!tab) return
        const pageType = mapKindToPageType(tab.kind)
        if (!pageType) return

        const tabId = useWorkspaceTabsStore
          .getState()
          .activateOrCreate(location.pathname, location.search, pageType)

        if (tabId && tab.title) {
          useWorkspaceTabsStore.getState().setTabTitle(tabId, tab.title)
        }
      }}
      onOpenFailed={onOpenFailed}
    />
  )
}

// Легаси-рендерер — штатный гейт раскатки (404/422 SCREEN_NOT_SDUI на OPEN),
// удаляется вместе с выводом старого бэка из эксплуатации.
const LegacyModulePage = () => {
  const { pageCode = '' } = useParams<{ pageCode: string }>()
  const navigate = useNavigate()
  const title = usePageTitle(`/modules/${pageCode}`, pageCode)
  useTabMeta(title)

  const handleClose = () => {
    void navigate('/')
  }

  return (
    <div className="flex flex-col gap-8 pt-5">
      <ModuleToolbar title={title} onClose={handleClose} />
      <Suspense fallback={<ModuleNavSkeleton />}>
        <ModuleContent pageCode={pageCode} />
      </Suspense>
    </div>
  )
}

const ModuleContent = ({ pageCode }: { pageCode: string }) => {
  const { data } = useModule(pageCode)
  // Для «Администрирования» добавляем подраздел «Готовые отчёты» (все ACTIVE-отчёты
  // из /api/reports) отдельной колонкой; для остальных модулей — без изменений.
  const reportsSection = useReadyReportsSection(pageCode)
  // Готовые отчёты — первой (левой) колонкой, чтобы подраздел был на виду.
  const items = reportsSection ? [[reportsSection], ...data] : data

  return <ModuleNavList items={items} pageCode={pageCode} />
}

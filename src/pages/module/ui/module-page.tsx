import { Suspense } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useModule } from '@/entities/module'
import { useTabMeta } from '@/features/workspace-tabs'

import { ModuleToolbar } from '@/widgets/module-toolbar'

import { ModuleNavList } from './module-nav-list'
import { usePageTitle } from '../lib/hooks/use-page-title'
import { ModuleNavSkeleton } from './module-nav-skeleton'
import { useReadyReportsSection } from '../lib/hooks/use-ready-reports-section'

export const ModulePage = () => {
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

import { Suspense } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useModule } from '@/entities/module'

import { ModuleToolbar } from '@/widgets/module-toolbar'

import { ModuleNavList } from './module-nav-list'
import { usePageTitle } from '../lib/hooks/use-page-title'
import { ModuleNavSkeleton } from './module-nav-skeleton'

export const ModulePage = () => {
  const { pageCode = '' } = useParams<{ pageCode: string }>()
  const navigate = useNavigate()
  const title = usePageTitle(`/modules/${pageCode}`, pageCode)

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

  return <ModuleNavList items={data} pageCode={pageCode} />
}

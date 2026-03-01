import { Suspense } from 'react'
import { useParams } from 'react-router-dom'

import { PageToolbar } from '@/widgets/page-toolbar'

import { useModule } from '../lib/hooks/use-module'
import { usePageTitle } from '../lib/hooks/use-page-title'
import { ModuleNavList } from './module-nav-list'
import { ModuleNavSkeleton } from './module-nav-skeleton'

export const ModulePage = () => {
  const { pageCode = '' } = useParams<{ pageCode: string }>()
  const title = usePageTitle(`/modules/${pageCode}`, pageCode)

  return (
    <div className="flex flex-col gap-8 pt-5">
      <PageToolbar title={title} />
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

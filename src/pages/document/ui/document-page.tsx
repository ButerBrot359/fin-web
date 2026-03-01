import { useParams } from 'react-router-dom'

import { PageHeader } from '@/widgets/page-header'
import { NoContent } from '@/shared/ui/no-content/no-content'

import { useModuleTitle } from '../lib/hooks/use-module-title'

export const DocumentPage = () => {
  const { pageCode = '', moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()
  const title = useModuleTitle(pageCode, moduleCode)

  return (
    <div className="flex flex-col gap-8 pt-5">
      <PageHeader title={title} />
      <NoContent />
    </div>
  )
}

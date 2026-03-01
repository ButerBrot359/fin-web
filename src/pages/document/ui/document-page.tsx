import { useParams } from 'react-router-dom'

import { PageHeader } from '@/widgets/page-header'
import { NoContent } from '@/shared/ui/no-content/no-content'

export const DocumentPage = () => {
  const { moduleCode = '' } = useParams<{ moduleCode: string }>()

  return (
    <div className="flex flex-col gap-8 pt-5">
      <PageHeader title={moduleCode} />
      <NoContent />
    </div>
  )
}

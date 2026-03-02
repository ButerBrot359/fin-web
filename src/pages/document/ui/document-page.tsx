import { PageHeader } from '@/widgets/page-header'
import { NoContent } from '@/shared/ui/no-content/no-content'

import { useDocumentType } from '../lib/hooks/use-document-type'

export const DocumentPage = () => {
  const { title } = useDocumentType()

  return (
    <div className="flex flex-col gap-8 pt-5">
      <PageHeader title={title} />
      <NoContent />
    </div>
  )
}

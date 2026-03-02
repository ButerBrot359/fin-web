import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'
import { NoContent } from '@/shared/ui/no-content/no-content'

import { useDocumentType } from '../lib/hooks/use-document-type'

export const DocumentPage = () => {
  const { title } = useDocumentType()

  return (
    <div className="flex flex-col gap-5 pt-5">
      <PageHeader title={title} />
      <DocumentListToolbar />
      <NoContent />
    </div>
  )
}

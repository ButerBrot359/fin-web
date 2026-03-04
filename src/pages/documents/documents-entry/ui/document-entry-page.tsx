import { useParams } from 'react-router-dom'
import { Typography } from '@mui/material'

import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar } from '@/widgets/document-form-toolbar'

export const DocumentEntryPage = () => {
  const { moduleCode, entryId } = useParams()

  const isNew = !entryId || entryId === 'new'
  const title = isNew
    ? `${moduleCode ?? ''} — new`
    : `${moduleCode ?? ''} — ${entryId}`

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} />
      <DocumentFormToolbar />

      <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-gray-300">
        <Typography variant="body1" color="textSecondary">
          Form placeholder
        </Typography>
      </div>
    </div>
  )
}

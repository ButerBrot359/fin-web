import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import {
  useDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'
import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar } from '@/widgets/document-form-toolbar'

const MOCK_ENTRY_NUMBER = '000000001'

export const DocumentEntryPage = () => {
  const { moduleCode = '', entryId } = useParams()
  const { t, i18n } = useTranslation()
  const { title, attributes } = useDocumentType(moduleCode)

  const isNew = !entryId || entryId === 'new'

  const pageTitle = isNew
    ? t('documentEntry.newTitle', { name: title })
    : t('documentEntry.editTitle', { name: title, number: MOCK_ENTRY_NUMBER })

  const formAttributes = attributes
    .filter((attr: DocumentAttribute) => attr.showInForm)
    .sort(
      (a: DocumentAttribute, b: DocumentAttribute) => a.sortOrder - b.sortOrder
    )

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} />
      <DocumentFormToolbar />

      <div className="flex flex-1 flex-col gap-4 rounded-md border border-ui-03 p-6">
        {formAttributes.map((attr) => {
          const label =
            i18n.language === 'kz' ? attr.nameKz || attr.nameRu : attr.nameRu

          return (
            <div key={attr.id} className="flex items-center gap-4">
              <Typography variant="body2" className="w-48 shrink-0 text-ui-05">
                {label}
                {attr.isRequired && ' *'}
              </Typography>
              <div className="h-9 flex-1 rounded-md border border-ui-03 bg-ui-01 px-3" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

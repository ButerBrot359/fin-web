import { useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'

import { SduiDocumentPage } from './sdui-document-page'
import { LegacyDocumentEntryPage } from './legacy-document-entry-page'

export const DocumentEntryPage = () => {
  const { moduleCode = '' } = useParams()
  const { newView } = useDocumentType(moduleCode)

  if (newView) {
    return <SduiDocumentPage moduleCode={moduleCode} />
  }
  return <LegacyDocumentEntryPage />
}

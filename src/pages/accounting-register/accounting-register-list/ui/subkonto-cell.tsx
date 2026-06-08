import { Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getDocumentEntry, type DocumentEntry } from '@/entities/document-entry'
import {
  useDictionaryEntry,
  resolveDictionaryEntryLabel,
} from '@/shared/lib/dictionary-entry'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { SubkontoRef } from '../utils/subkonto'

interface SubkontoCellProps {
  /** Ссылка субконто (тип + ID) из subkontosDt/subkontosKt. */
  subkonto: SubkontoRef | null
}

/**
 * Ячейка колонки субконто (Субконто1..3 Дт/Кт).
 *
 * В строке `/search` субконто — это ссылка `{ valueType, *ReferenceId }`,
 * значение хранится как ID. Резолвим ID → имя по типу значения:
 * DICTIONARY → справочник, DOCUMENT → документ, остальное → показываем ID.
 */
export const SubkontoCell = ({ subkonto }: SubkontoCellProps) => {
  const { i18n } = useTranslation()
  const id = subkonto?.refId ?? null
  const isDict = subkonto?.valueType === 'DICTIONARY'
  const isDoc = subkonto?.valueType === 'DOCUMENT'

  const { entry: dictEntry } = useDictionaryEntry(isDict ? id : null)

  const { data: docEntry } = useQuery<DocumentEntry>({
    queryKey: ['document-entry-by-id', id],
    queryFn: () => getDocumentEntry(String(id)).then((res) => res.data.data),
    enabled: isDoc && id != null,
    staleTime: Infinity,
  })

  let text = ''
  if (id != null) {
    if (isDict) {
      text = resolveDictionaryEntryLabel(dictEntry, id)
    } else if (isDoc) {
      const name = docEntry ? getLocalizedName(docEntry, i18n.language) : ''
      text = name || docEntry?.code || `#${String(id)}`
    } else {
      text = String(id)
    }
  }

  return (
    <Typography variant="body2" noWrap className="text-ui-06">
      {text}
    </Typography>
  )
}

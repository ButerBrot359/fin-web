import { Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getDocumentEntry, type DocumentEntry } from '@/entities/document-entry'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

interface RecorderCellProps {
  /** ID документа-регистратора из строки (`recorderDocumentEntryId`). */
  id: number | null | undefined
}

/**
 * Ячейка колонки «Регистратор» регистра бухгалтерии.
 *
 * Бэк отдаёт только ID документа-регистратора (аналог 1C: ссылка `Recorder`).
 * Резолвит ID → представление документа через `/api/document-entries/id/{id}`
 * с бессрочным кэшем (записи документов стабильны) и дедупликацией
 * повторяющихся ID React Query'ем. Пока имя не загружено / не разрешилось —
 * показываем `#<id>` как запасной вариант.
 */
export const RecorderCell = ({ id }: RecorderCellProps) => {
  const { i18n } = useTranslation()

  const { data: entry } = useQuery<DocumentEntry>({
    queryKey: ['document-entry-by-id', id],
    queryFn: () => getDocumentEntry(String(id)).then((res) => res.data.data),
    enabled: id != null,
    staleTime: Infinity,
  })

  let text = ''
  if (id != null) {
    const name = entry ? getLocalizedName(entry, i18n.language) : ''
    text = name || entry?.code || `#${String(id)}`
  }

  return (
    <Typography variant="body2" noWrap className="text-ui-06">
      {text}
    </Typography>
  )
}

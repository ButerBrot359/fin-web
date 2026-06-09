import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import {
  useDictionaryEntry,
  resolveDictionaryEntryLabel,
} from '@/shared/lib/dictionary-entry'

import type { OsvSubkonto } from '../types/osv-report'

interface SubkontoNameCellProps {
  /** Аналитика дочерней строки (null — группа «Без субконто»). */
  subkonto: OsvSubkonto | null | undefined
}

/**
 * Ячейка «Наименование» дочерней строки ОСВ (строка по субконто-1).
 *
 * Резолвит ID субконто в человекочитаемое имя тем же механизмом, что и
 * измерения журнала проводок (`DimensionCell`): через
 * `useDictionaryEntry` + `resolveDictionaryEntryLabel`. Для субконто без
 * аналитики показывает i18n-метку «Без субконто».
 */
export const SubkontoNameCell = ({ subkonto }: SubkontoNameCellProps) => {
  const { t } = useTranslation()
  const refId = subkonto?.dictionaryEntryReferenceId ?? null
  const { entry } = useDictionaryEntry(refId)

  let text = t('osv.noSubkonto')
  if (refId != null) {
    text = resolveDictionaryEntryLabel(entry, refId)
  }

  return (
    <Typography variant="body2" noWrap className="text-ui-06">
      {text}
    </Typography>
  )
}

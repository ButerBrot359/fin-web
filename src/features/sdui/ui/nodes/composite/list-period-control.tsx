// SCRUM-291: контрол периода LIST — вынесен из list-node.tsx (split на файлы
// < 300 строк). Поведение перенесено verbatim, см. list-node.tsx history.
import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeInput } from '@/shared/ui/inputs'
import type { useSduiDispatch } from '../../../lib/dispatch'
import type { ListPeriod } from './list-column-defs'

// SCRUM-291 2d: period — независимый от колоночных фильтров контрол на LIST
// (не в TOOLBAR, без чипа). {from:null,to:null} — валидный вызов, снимающий
// период; отдельной команды clearPeriod нет (design §2d).
export const ListPeriodControl: FC<{
  period: ListPeriod
  typeCode: string
  nodeId: string
  dispatch: ReturnType<typeof useSduiDispatch>
}> = ({ period, typeCode, nodeId, dispatch }) => {
  const { t } = useTranslation()

  const applyPeriod = (next: ListPeriod) => {
    void dispatch({
      type: 'COMMAND',
      command: `list.applyPeriod:${typeCode}`,
      value: next,
      sourceNodeId: nodeId,
    })
  }

  return (
    <div className="flex items-center gap-2">
      <DateTimeInput
        label={t('table.periodFrom')}
        value={period.from ?? ''}
        dateOnly
        onChange={(value) => {
          applyPeriod({ from: value || null, to: period.to })
        }}
      />
      <DateTimeInput
        label={t('table.periodTo')}
        value={period.to ?? ''}
        dateOnly
        onChange={(value) => {
          applyPeriod({ from: period.from, to: value || null })
        }}
      />
    </div>
  )
}

import type { FC } from 'react'
import {
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ClassifierPickerCalendar } from '../../../../api/production-calendar-classifier'

export interface ClassifierPickerTableProps {
  calendars: ClassifierPickerCalendar[]
  selectedCodes: string[]
  disabled: boolean
  onToggle: (calendarCode: string, selected: boolean) => void
}

// Таблица календарей классификатора (§8.5): checkbox multi-select, «Код»,
// «Наименование». Отметка НЕ optimistic — чекбокс отражает serверный snapshot.
export const ClassifierPickerTable: FC<ClassifierPickerTableProps> = ({
  calendars,
  selectedCodes,
  disabled,
  onToggle,
}) => {
  const { t } = useTranslation()
  const selected = new Set(selectedCodes)

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell padding="checkbox" />
          <TableCell>{t('sdui.productionCalendar.classifier.code')}</TableCell>
          <TableCell>{t('sdui.productionCalendar.classifier.name')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {calendars.map((c) => (
          <TableRow key={c.code} hover>
            <TableCell padding="checkbox">
              <Checkbox
                checked={selected.has(c.code)}
                disabled={disabled}
                onChange={(e) => {
                  onToggle(c.code, e.target.checked)
                }}
              />
            </TableCell>
            <TableCell>{c.code}</TableCell>
            <TableCell>{c.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

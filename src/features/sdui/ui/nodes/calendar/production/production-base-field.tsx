import type { FC } from 'react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Select,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ProductionCalendarBaseCandidate } from '../../../../lib/calendar/production-calendar-types'

export interface ProductionBaseFieldProps {
  hasBaseCalendar: boolean
  baseCalendarEntryId: number | null
  candidates: ProductionCalendarBaseCandidate[]
  busy: boolean
  editable: boolean
  onEnable: () => void
  onClear: () => void
  onSelect: (entryId: number) => void
}

// Локализованная подпись кандидата (§5.3): kz → nameKz→nameRu→code,
// ru → nameRu→nameKz→code. Synthetic-кандидатов фронт не создаёт.
const candidateLabel = (
  c: ProductionCalendarBaseCandidate,
  language: string
): string => {
  const ordered =
    language === 'kz'
      ? [c.nameKz, c.nameRu, c.code]
      : [c.nameRu, c.nameKz, c.code]
  return ordered.find((v) => v != null && v !== '') ?? String(c.id)
}

// Inline-группа базового календаря (§13.8). Не рендерится хозяином при
// baseVisible !== true; отдельного base-dialog по спеке НЕ существует.
export const ProductionBaseField: FC<ProductionBaseFieldProps> = ({
  hasBaseCalendar,
  baseCalendarEntryId,
  candidates,
  busy,
  editable,
  onEnable,
  onClear,
  onSelect,
}) => {
  const { t, i18n } = useTranslation()

  const selectionMissing = hasBaseCalendar && baseCalendarEntryId == null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <FormControlLabel
        control={
          <Checkbox
            checked={hasBaseCalendar}
            disabled={busy || !editable}
            onChange={(e) => {
              if (e.target.checked) onEnable()
              else onClear()
            }}
          />
        }
        label={t('sdui.productionCalendar.baseCalendar')}
      />
      {hasBaseCalendar && (
        <FormControl size="small" error={selectionMissing} className="min-w-56">
          <Select
            size="small"
            value={baseCalendarEntryId ?? ''}
            displayEmpty
            disabled={busy || !editable || candidates.length === 0}
            onChange={(e) => {
              const id = e.target.value
              if (typeof id === 'number' && id > 0) onSelect(id)
            }}
          >
            {candidates.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {candidateLabel(c, i18n.language)}
              </MenuItem>
            ))}
          </Select>
          {selectionMissing && (
            <FormHelperText>
              {t('sdui.productionCalendar.baseSelectRequired')}
            </FormHelperText>
          )}
          {candidates.length === 0 && (
            <FormHelperText>
              {t('sdui.productionCalendar.baseNoCandidates')}
            </FormHelperText>
          )}
        </FormControl>
      )}
    </div>
  )
}

import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

export interface ListFilterChip {
  field: string
  label: string
}

export interface ListFilterChipsProps {
  chips: ListFilterChip[]
  onRemove: (field: string) => void
  onClearAll: () => void
}

// SCRUM-291 2c-b: панель чипов на LIST-ноде (design §2c, spec §7 «Чипы»).
// `label` приходит с сервера ПОЛНОСТЬЮ готовым (заголовок колонки + подпись
// оператора + презентация значения) — рендерим как есть, не парсим и не
// пересобираем. Период сюда никогда не попадает (§8): сервер его в
// filterChips не кладёт, фронт с этим массивом не работает отдельно.
export const ListFilterChips: FC<ListFilterChipsProps> = ({
  chips,
  onRemove,
  onClearAll,
}) => {
  const { t } = useTranslation()

  if (chips.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="region"
      aria-label={t('table.filterActiveTitle')}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.field}
          size="small"
          variant="outlined"
          label={chip.label}
          onDelete={() => {
            onRemove(chip.field)
          }}
          deleteIcon={
            <CloseIcon
              fontSize="small"
              aria-label={t('table.filterRemoveChip')}
            />
          }
        />
      ))}
      <Button
        size="small"
        color="warning"
        onClick={() => {
          onClearAll()
        }}
      >
        {t('table.filterClearAll')}
      </Button>
    </div>
  )
}

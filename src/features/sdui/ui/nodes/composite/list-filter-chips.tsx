import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

export interface ListFilterChip {
  field: string
  label: string
  /**
   * Отбор задан маршрутом (пункт меню), снимать его нельзя — чип рисуется без крестика.
   * В 1С это поле отбора формы списка с `ReadOnly`: «Регламентная операция» открывается
   * командой раздела, и вид операции пользователь только видит.
   */
  fixed?: boolean
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

  // «Сбросить все» имеет смысл, только если есть что сбрасывать. В списке
  // регламентных операций единственный отбор — маршрутный вид операции, и кнопка
  // предлагала снять то, что снять нельзя (обращение 20.09.2026).
  const estSemnye = chips.some((chip) => chip.fixed !== true)

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
          onDelete={
            chip.fixed === true
              ? undefined
              : () => {
                  onRemove(chip.field)
                }
          }
          deleteIcon={
            <CloseIcon
              fontSize="small"
              aria-label={t('table.filterRemoveChip')}
            />
          }
        />
      ))}
      {estSemnye && (
        <Button
          size="small"
          color="warning"
          onClick={() => {
            onClearAll()
          }}
        >
          {t('table.filterClearAll')}
        </Button>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

/**
 * Выпадающий список «Язык формы» — Русский / Казахский (как в Инвентарной карточке).
 * Значение параметра — boolean (true = русский, false = казахский), как у `YazykFormy`
 * мемориальных ордеров и Оборотной ведомости ТМЗ; наружу отдаём boolean через `onChange`.
 */
export const LanguageSelect = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (isRu: boolean) => void
}) => {
  const { t } = useTranslation()
  const options = useMemo<SelectOption[]>(
    () => [
      { id: 'RU', code: 'RU', label: t('reports.russian') },
      { id: 'KZ', code: 'KZ', label: t('reports.kazakh') },
    ],
    [t]
  )
  const selected = options.find((o) => o.id === (value ? 'RU' : 'KZ')) ?? null
  return (
    <AutocompleteInput
      value={selected}
      options={options}
      onChange={(o) => {
        onChange(o?.id === 'RU')
      }}
      label={label}
      // medium (обычная высота): у filled-поля с size="small" «плавающая» метка
      // «Язык» наезжала на значение «Русский» — не хватало высоты.
      size="medium"
      fullWidth
    />
  )
}

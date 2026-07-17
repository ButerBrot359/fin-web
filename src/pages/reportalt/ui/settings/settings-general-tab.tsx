import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import type { ReportAltParameterDto } from '../../types/reportalt'

interface SettingsGeneralTabProps {
  /** Параметр «Язык формы» (YazykFormy): allowedValues [Ru,Kz]. */
  langParam: ReportAltParameterDto
  /** Текущее значение параметра (values[YazykFormy]): 'Ru' | 'Kz' | ''. */
  value: string
  onChange: (value: string) => void
  isKz: boolean
}

/**
 * Вкладка «Основные» панели настроек ReportAlt — выбор «Язык формы»
 * (Русский/Казахский), как секция «Язык печатной формы» в 1С и вкладка
 * «Основные» легаси-контура. Значение — ПАРАМЕТР отчёта YazykFormy (не
 * userSettings-дельта): пишется в param-state страницы через `onChange` и уходит
 * в тело `/run` полем `parameters` при «Применить»/«Сформировать». Опции берём
 * из `allowedValues` параметра (титулы Русский/Казахский • Орысша/Қазақша с
 * бэка), подпись — из i18n (совпадает с titleRu/titleKz параметра).
 */
export const SettingsGeneralTab = ({
  langParam,
  value,
  onChange,
  isKz,
}: SettingsGeneralTabProps) => {
  const { t } = useTranslation()

  const options = useMemo<SelectOption[]>(
    () =>
      (langParam.allowedValues ?? []).map((av) => ({
        id: String(av.value),
        code: String(av.value),
        label: (isKz ? av.titleKz : av.titleRu) || av.titleRu,
      })),
    [langParam.allowedValues, isKz]
  )
  const selected = options.find((o) => o.id === value) ?? null

  return (
    <div className="flex flex-col gap-2 pt-1">
      <AutocompleteInput
        value={selected}
        options={options}
        onChange={(o) => {
          onChange(o ? String(o.id) : '')
        }}
        label={t('reportalt.formLanguage')}
        // medium (обычная высота): у filled-поля с size="small" плавающая метка
        // наезжает на значение — как в легаси LanguageSelect.
        size="medium"
        fullWidth
      />
    </div>
  )
}

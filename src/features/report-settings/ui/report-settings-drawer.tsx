import { useState, type ReactNode } from 'react'
import {
  Checkbox,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { FilterPicker } from './filter-picker'

/** Один переключаемый пункт (измерение, вид субконто или показатель). */
export interface ReportGroupItem {
  key: string
  label: string
  checked: boolean
}

/** Один отбор: поле (= справочник) + выбранное значение (ID записи). */
export interface ReportFilterItem {
  key: string
  label: string
  /** Код справочника-источника значений. */
  dictTypeCode: string
  valueId: number | null
}

interface ReportSettingsDrawerProps {
  open: boolean
  onClose: () => void
  /** Пункты вкладки «Группировка» (измерения + виды субконто). */
  groupItems: ReportGroupItem[]
  onToggleGroup: (key: string) => void
  /** Пункты вкладки «Показатели» (Сумма / Количество / …). Опционально. */
  indicatorItems?: ReportGroupItem[]
  onToggleIndicator?: (key: string) => void
  /** Отборы вкладки «Отборы» (поле → значение). Опционально. */
  filterItems?: ReportFilterItem[]
  onFilterChange?: (key: string, valueId: number | null) => void
}

/** Список чекбоксов одной вкладки. */
const CheckboxList = ({
  items,
  onToggle,
}: {
  items: ReportGroupItem[]
  onToggle: (key: string) => void
}) => (
  <div className="flex flex-col">
    {items.map((item) => (
      <FormControlLabel
        key={item.key}
        control={
          <Checkbox
            size="small"
            checked={item.checked}
            onChange={() => {
              onToggle(item.key)
            }}
          />
        }
        label={item.label}
      />
    ))}
  </div>
)

/**
 * Боковая панель «Настройки» отчёта (как в 1С). Вкладки: «Группировка»
 * (всегда), «Показатели» и «Отборы» (опционально). Переиспользуется отчётами
 * (карточка счёта, ОСВ).
 */
export const ReportSettingsDrawer = ({
  open,
  onClose,
  groupItems,
  onToggleGroup,
  indicatorItems,
  onToggleIndicator,
  filterItems,
  onFilterChange,
}: ReportSettingsDrawerProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)

  // Собираем видимые вкладки: «Группировка» всегда, остальные — если переданы.
  const tabs: { label: string; content: ReactNode }[] = [
    {
      label: t('reportSettings.grouping'),
      content: <CheckboxList items={groupItems} onToggle={onToggleGroup} />,
    },
  ]
  if (indicatorItems != null && indicatorItems.length > 0 && onToggleIndicator) {
    tabs.push({
      label: t('reportSettings.indicators'),
      content: (
        <CheckboxList items={indicatorItems} onToggle={onToggleIndicator} />
      ),
    })
  }
  if (filterItems != null && filterItems.length > 0 && onFilterChange) {
    tabs.push({
      label: t('reportSettings.filters'),
      content: (
        <div className="flex flex-col gap-3 pt-1">
          {filterItems.map((f) => (
            <FilterPicker
              key={f.key}
              label={f.label}
              dictTypeCode={f.dictTypeCode}
              valueId={f.valueId}
              onChange={(v) => {
                onFilterChange(f.key, v)
              }}
            />
          ))}
        </div>
      ),
    })
  }

  const activeTab = Math.min(tab, tabs.length - 1)

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <div className="flex w-80 flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <Typography variant="h6" className="font-semibold text-ui-06">
            {t('reportSettings.title')}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label={t('actions.cancel')}
          >
            ✕
          </IconButton>
        </div>

        <Divider />

        {tabs.length > 1 ? (
          <Tabs
            value={activeTab}
            onChange={(_e, v: number) => {
              setTab(v)
            }}
            variant="fullWidth"
          >
            {tabs.map((tb) => (
              <Tab key={tb.label} label={tb.label} />
            ))}
          </Tabs>
        ) : (
          <Typography variant="subtitle2" className="text-ui-05">
            {t('reportSettings.grouping')}
          </Typography>
        )}

        {tabs[activeTab]?.content}
      </div>
    </Drawer>
  )
}

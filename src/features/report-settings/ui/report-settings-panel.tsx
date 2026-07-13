import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Checkbox,
  FormControlLabel,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'

import type {
  ReportFilterDto,
  ReportParameterDto,
} from '@/pages/reports/report-list/types/report'
import { AutocompleteInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import type { ReportGroupItem } from './report-settings-drawer'
import { ReportFilterTable } from './report-filter-table'
import type {
  ReportAppearance,
  ReportFilterRow,
} from '../lib/report-filter-model'

/** Тёмно-зелёный 1С для заголовков разделов настроек (как в живом СКД). */
const GREEN_1C = 'rgb(0,63,47)'

interface ReportSettingsPanelProps {
  isKz: boolean
  /** Варианты группировки отчёта (селектор «Вариант»). ≤1 ⇒ не показывать. */
  variantOptions: SelectOption[]
  selectedVariant: string | null
  onVariantChange: (code: string) => void
  /** Тумблеры формы (напр. «Язык формы (рус/каз)») — верх вкладки «Основные», как у МО. */
  formToggleItems: ReportGroupItem[]
  onToggleFormParam: (key: string) => void
  /** Показатели (Сумма / Количество / …) — раздел «Показатели» вкладки «Основные». */
  indicatorItems: ReportGroupItem[]
  onToggleIndicator: (key: string) => void
  /** Группировки-измерения результата — отдельная вкладка «Группировка». */
  groupItems: ReportGroupItem[]
  onToggleGroup: (key: string) => void
  /** Параметр «Периодичность» (NUMBER+allowedValues) — раздел «Группировка». */
  periodicityParam?: ReportParameterDto
  periodicityValue: number | string | null
  onPeriodicityChange: (v: number | '') => void
  /** Доступные поля отбора (КБП + субконто счёта) из /filter-fields. */
  filterFields: ReportFilterDto[]
  filterRows: ReportFilterRow[]
  onFilterRowsChange: (rows: ReportFilterRow[]) => void
  /** Оформление (выделять отрицательные / уменьшенный автоотступ). */
  appearance: ReportAppearance
  onAppearanceChange: (patch: Partial<ReportAppearance>) => void
}

/** Заголовок раздела настроек 1С: жирный тёмно-зелёный. */
const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Typography
    variant="subtitle2"
    sx={{ color: GREEN_1C, fontWeight: 700, mt: 1 }}
  >
    {children}
  </Typography>
)

/** Список чекбоксов одного раздела. */
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
 * Докнутая панель настроек стандартного бухотчёта — 1-в-1 как справа в 1С:БГУ:
 * всегда видима рядом с результатом, вкладки в нормальном регистре
 * «Основные | Отборы | Оформление». «Основные» = показатели + группировка
 * (периодичность и измерения). «Отборы» = полная СКД-таблица. «Оформление» =
 * выделение отрицательных и автоотступ.
 */
export const ReportSettingsPanel = ({
  isKz,
  variantOptions,
  selectedVariant,
  onVariantChange,
  formToggleItems,
  onToggleFormParam,
  indicatorItems,
  onToggleIndicator,
  groupItems,
  onToggleGroup,
  periodicityParam,
  periodicityValue,
  onPeriodicityChange,
  filterFields,
  filterRows,
  onFilterRowsChange,
  appearance,
  onAppearanceChange,
}: ReportSettingsPanelProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)

  // Опции периодичности из allowedValues параметра.
  const periodicityOptions = useMemo<SelectOption[]>(
    () =>
      (periodicityParam?.allowedValues ?? []).map((av) => ({
        id: av.value,
        code: String(av.value),
        label: (isKz ? av.titleKz : av.titleRu) || av.titleRu,
      })),
    [periodicityParam, isKz]
  )
  const periodicitySelected =
    periodicityValue == null || periodicityValue === ''
      ? null
      : (periodicityOptions.find(
          (o) => Number(o.id) === Number(periodicityValue)
        ) ?? null)

  const periodicityLabel = periodicityParam
    ? (isKz ? periodicityParam.titleKz : periodicityParam.titleRu) ||
      periodicityParam.titleRu
    : ''

  return (
    <div className="w-[340px] shrink-0 rounded-md border border-ui-04 bg-white">
      <Tabs
        value={tab}
        onChange={(_e, v: number) => {
          setTab(v)
        }}
        variant="fullWidth"
        sx={{ textTransform: 'none', minHeight: 40 }}
      >
        <Tab
          label={t('reportSettings.basic')}
          sx={{ textTransform: 'none', minHeight: 40 }}
        />
        <Tab
          label={t('reportSettings.grouping')}
          sx={{ textTransform: 'none', minHeight: 40 }}
        />
        <Tab
          label={t('reportSettings.filters')}
          sx={{ textTransform: 'none', minHeight: 40 }}
        />
        <Tab
          label={t('reportSettings.appearance')}
          sx={{ textTransform: 'none', minHeight: 40 }}
        />
      </Tabs>

      <div className="flex flex-col gap-2 p-3">
        {/* ── Основные ─────────────────────────────────────────────── */}
        {tab === 0 && (
          <>
            {/* Тумблеры формы (язык и т.п.) — сверху, как «Детализация» у МО. */}
            {formToggleItems.length > 0 && (
              <CheckboxList
                items={formToggleItems}
                onToggle={onToggleFormParam}
              />
            )}

            {indicatorItems.length > 0 && (
              <>
                <SectionTitle>{t('reportSettings.indicators')}</SectionTitle>
                <CheckboxList
                  items={indicatorItems}
                  onToggle={onToggleIndicator}
                />
              </>
            )}
          </>
        )}

        {/* ── Группировка ──────────────────────────────────────────── */}
        {tab === 1 && (
          <>
            {variantOptions.length > 1 && (
              <AutocompleteInput
                value={
                  variantOptions.find(
                    (o) => String(o.id) === selectedVariant
                  ) ?? null
                }
                options={variantOptions}
                onChange={(o) => {
                  if (o) onVariantChange(String(o.id))
                }}
                label={t('reportSettings.variant')}
                size="small"
                fullWidth
              />
            )}
            {periodicityParam && (
              <AutocompleteInput
                value={periodicitySelected}
                options={periodicityOptions}
                onChange={(o) => {
                  onPeriodicityChange(o ? Number(o.id) : '')
                }}
                label={periodicityLabel}
                size="small"
                fullWidth
              />
            )}
            {groupItems.length > 0 ? (
              <CheckboxList items={groupItems} onToggle={onToggleGroup} />
            ) : (
              !periodicityParam && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t('reportSettings.noGrouping')}
                </Typography>
              )
            )}
          </>
        )}

        {/* ── Отборы ───────────────────────────────────────────────── */}
        {tab === 2 && (
          <ReportFilterTable
            fields={filterFields}
            rows={filterRows}
            onRowsChange={onFilterRowsChange}
            isKz={isKz}
          />
        )}

        {/* ── Оформление ───────────────────────────────────────────── */}
        {tab === 3 && (
          <div className="flex flex-col">
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={appearance.highlightNegatives}
                  onChange={(e) => {
                    onAppearanceChange({ highlightNegatives: e.target.checked })
                  }}
                />
              }
              label={t('reportSettings.highlightNegatives')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={appearance.reducedIndent}
                  onChange={(e) => {
                    onAppearanceChange({ reducedIndent: e.target.checked })
                  }}
                />
              }
              label={t('reportSettings.reducedIndent')}
            />
          </div>
        )}
      </div>
    </div>
  )
}

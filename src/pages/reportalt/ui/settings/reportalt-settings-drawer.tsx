import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Divider,
  Drawer,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'

import type {
  ReportAltAppearanceFlagDto,
  ReportAltMetaDto,
} from '../../types/reportalt'
import {
  defaultFieldRows,
  type ReportAltSettingsState,
} from '../../lib/utils/user-settings'
import { SettingsFieldsTab } from './settings-fields-tab'
import { SettingsFiltersTab } from './settings-filters-tab'
import { SettingsOrderTab } from './settings-order-tab'
import { SettingsGroupingTab } from './settings-grouping-tab'
import { SettingsAppearanceTab } from './settings-appearance-tab'

interface ReportAltSettingsDrawerProps {
  open: boolean
  onClose: () => void
  meta: ReportAltMetaDto
  /** Черновик дельты настроек (null = стандартные настройки варианта). */
  draft: ReportAltSettingsState | null
  onDraftChange: (draft: ReportAltSettingsState) => void
  /** «Применить» — записать дельту в URL/localStorage и переформировать. */
  onApply: () => void
  /** «Стандартные настройки» — пустая дельта (сброс к варианту). */
  onReset: () => void
}

/**
 * Боковая панель настроек отчёта ReportAlt (settings-design §7) по визуальному
 * образцу легаси `features/report-settings`, но на новом контракте meta.
 * Вкладки Поля/Отборы/Сортировка/Группировка/Оформление показываются только
 * если meta их наполнила (F-S3: пусто у не-adopted хендлеров).
 */
export const ReportAltSettingsDrawer = ({
  open,
  onClose,
  meta,
  draft,
  onDraftChange,
  onApply,
  onReset,
}: ReportAltSettingsDrawerProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'
  const [tab, setTab] = useState(0)

  const availableFields = meta.availableFields ?? []
  const columnFields = availableFields.filter(
    (f) => f.availableAsColumn === true
  )
  const orderFields = availableFields.filter((f) => f.availableAsOrder === true)
  const filterFields = meta.filters ?? []
  const groupingOptions = meta.availableGroupings ?? []

  // Флажки оформления: из meta; фолбэк — встроенный highlightNegatives
  // (в 1С по умолчанию включён), пока meta-узел не зафиксирован контрактом.
  const appearanceDefs = useMemo<ReportAltAppearanceFlagDto[]>(() => {
    if (meta.appearanceFlags != null && meta.appearanceFlags.length > 0) {
      return meta.appearanceFlags
    }
    if (columnFields.length === 0) return []
    return [
      {
        code: 'highlightNegatives',
        titleRu: t('reportalt.settings.highlightNegatives'),
        defaultValue: true,
      },
    ]
  }, [meta.appearanceFlags, columnFields.length, t])

  const patch = (patchPart: Partial<ReportAltSettingsState>) => {
    onDraftChange({ ...(draft ?? {}), ...patchPart })
  }

  const tabs: { key: string; label: string; content: ReactNode }[] = []
  if (columnFields.length > 0) {
    tabs.push({
      key: 'fields',
      label: t('reportalt.settings.fields'),
      content: (
        <SettingsFieldsTab
          availableFields={columnFields}
          rows={draft?.selectedFields ?? defaultFieldRows(meta)}
          onChange={(rows) => {
            patch({ selectedFields: rows })
          }}
          isKz={isKz}
        />
      ),
    })
  }
  if (filterFields.length > 0) {
    tabs.push({
      key: 'filters',
      label: t('reportalt.settings.filters'),
      content: (
        <SettingsFiltersTab
          fields={filterFields}
          rows={draft?.filters ?? []}
          onChange={(rows) => {
            patch({ filters: rows })
          }}
          isKz={isKz}
        />
      ),
    })
  }
  if (orderFields.length > 0) {
    tabs.push({
      key: 'order',
      label: t('reportalt.settings.order'),
      content: (
        <SettingsOrderTab
          orderFields={orderFields}
          rows={draft?.order ?? []}
          onChange={(rows) => {
            patch({ order: rows })
          }}
          isKz={isKz}
        />
      ),
    })
  }
  if (groupingOptions.length > 0) {
    tabs.push({
      key: 'grouping',
      label: t('reportalt.settings.grouping'),
      content: (
        <SettingsGroupingTab
          options={groupingOptions}
          value={draft?.grouping ?? {}}
          onChange={(value) => {
            patch({ grouping: value })
          }}
          isKz={isKz}
        />
      ),
    })
  }
  if (appearanceDefs.length > 0) {
    tabs.push({
      key: 'appearance',
      label: t('reportalt.settings.appearance'),
      content: (
        <SettingsAppearanceTab
          flagDefs={appearanceDefs}
          flags={draft?.appearanceFlags ?? {}}
          onChange={(flags) => {
            patch({ appearanceFlags: flags })
          }}
          isKz={isKz}
        />
      ),
    })
  }

  const activeTab = Math.min(tab, Math.max(tabs.length - 1, 0))

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <div className="flex h-full w-[480px] max-w-[92vw] flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <Typography variant="h6" className="font-semibold text-ui-06">
            {t('reportalt.settings.title')}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label={t('reportalt.settings.close')}
          >
            ✕
          </IconButton>
        </div>

        <Divider />

        <Tabs
          value={activeTab}
          onChange={(_e, v: number) => {
            setTab(v)
          }}
          variant="fullWidth"
        >
          {tabs.map((tb) => (
            <Tab
              key={tb.key}
              label={tb.label}
              sx={{ minWidth: 0, px: 1, textTransform: 'none' }}
            />
          ))}
        </Tabs>

        <div className="min-h-0 grow overflow-auto">
          {tabs[activeTab]?.content}
        </div>

        <Divider />

        <div className="flex items-center justify-between gap-2">
          <Button variant="outlined" size="small" onClick={onReset}>
            {t('reportalt.settings.reset')}
          </Button>
          <Button variant="contained" size="small" onClick={onApply}>
            {t('reportalt.settings.apply')}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

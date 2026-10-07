import { useTranslation } from 'react-i18next'
import { Divider, Drawer, IconButton, Typography } from '@mui/material'

import type {
  ReportAltMetaDto,
  ReportAltParameterDto,
} from '../../types/reportalt'
import type { ReportAltSettingsState } from '../../lib/utils/user-settings'
import type { ParamValues, ReportAltParamValue } from '../../lib/utils/params'
import { ReportAltSettingsBody } from './reportalt-settings-body'

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
  /**
   * Параметр «Язык формы» (YazykFormy), если он есть у отчёта — рендерится
   * первой вкладкой «Основные». Значение — параметр отчёта (не userSettings).
   */
  langParam?: ReportAltParameterDto | null
  langValue?: string
  onLangChange?: (value: string) => void
  groupingTitles?: Record<string, string>
  settingsParams?: ReportAltParameterDto[]
  byudzhetyParams?: ReportAltParameterDto[]
  paramValues?: ParamValues
  onParamChange?: (code: string, value: ReportAltParamValue) => void
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
  langParam,
  langValue,
  onLangChange,
  groupingTitles,
  settingsParams,
  byudzhetyParams,
  paramValues,
  onParamChange,
}: ReportAltSettingsDrawerProps) => {
  const { t } = useTranslation()

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

        <ReportAltSettingsBody
          meta={meta}
          draft={draft}
          onDraftChange={onDraftChange}
          onApply={onApply}
          onReset={onReset}
          langParam={langParam}
          langValue={langValue}
          onLangChange={onLangChange}
          groupingTitles={groupingTitles}
          settingsParams={settingsParams}
          byudzhetyParams={byudzhetyParams}
          paramValues={paramValues}
          onParamChange={onParamChange}
          fillHeight
        />
      </div>
    </Drawer>
  )
}

import { useTranslation } from 'react-i18next'
import { Drawer, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

import { panelZIndex } from '@/shared/lib/utils/overlay-z-index'
import { cssVar, palette, semantic } from '@/shared/design/tokens'

import type {
  ReportAltMetaDto,
  ReportAltParameterDto,
} from '../../types/reportalt'
import type { ReportAltSettingsState } from '../../lib/utils/user-settings'
import type { ParamValues, ReportAltParamValue } from '../../lib/utils/params'
import { ReportAltSettingsBody } from './reportalt-settings-body'

const SHIRINA_PANELI = 766
const FON_PANELI = cssVar(palette.ui02)
const FON_PODLOZHKI = cssVar(semantic.backdrop)

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
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      style={{ zIndex: panelZIndex(0) }}
      slotProps={{
        paper: {
          sx: {
            width: SHIRINA_PANELI,
            maxWidth: '100vw',
            borderTopLeftRadius: 40,
            borderBottomLeftRadius: 40,
            backgroundColor: FON_PANELI,
            overflow: 'hidden',
          },
        },
        backdrop: { sx: { backgroundColor: FON_PODLOZHKI } },
      }}
    >
      <div className="flex h-full flex-col gap-3 p-10">
        <div className="flex shrink-0 items-center justify-end">
          <IconButton
            onClick={onClose}
            aria-label={t('reportalt.settings.close')}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </div>

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

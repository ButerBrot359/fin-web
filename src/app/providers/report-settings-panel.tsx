import { useState, type FC } from 'react'

import { useReportAltMeta } from '@/pages/reportalt/lib/hooks/use-reportalt-meta'
import { ReportAltSettingsDrawer } from '@/pages/reportalt/ui/settings/reportalt-settings-drawer'
import {
  isEmptySettings,
  toUserSettingsDto,
  type ReportAltSettingsState,
} from '@/pages/reportalt/lib/utils/user-settings'

interface ReportSettingsPanelProps {
  reportCode: string
  appliedUserSettings: unknown
  onApply: (userSettings: unknown) => void
  onReset: () => void
  open: boolean
  onClose: () => void
}

/**
 * SCRUM-291 §19.1 — панель настроек отчёта для SDUI-ноды REPORT_RESULT.
 * Живёт в app/ (легаси-импорты разрешены только здесь): монтирует легаси
 * `ReportAltSettingsDrawer`, сам фетчит meta, на «Применить» собирает
 * ReportAltUserSettingsDto и отдаёт его SDUI-ноде через onApply — та накладывает
 * его на source.body. URL/localStorage тут НЕ трогаем (это делает страница
 * reportalt; для SDUI-оверлея персист не нужен).
 */
export const ReportSettingsPanel: FC<ReportSettingsPanelProps> = ({
  reportCode,
  onApply,
  onReset,
  open,
  onClose,
}) => {
  const { meta } = useReportAltMeta(reportCode)
  const [draft, setDraft] = useState<ReportAltSettingsState | null>(null)

  if (!meta) return null

  const availableColumnCodes = (meta.availableFields ?? [])
    .filter((f) => f.availableAsColumn === true)
    .map((f) => f.code)

  const handleApply = () => {
    const dto =
      draft != null && !isEmptySettings(draft)
        ? toUserSettingsDto(
            draft,
            meta.definition.schemaVersion,
            availableColumnCodes
          )
        : undefined
    onApply(dto)
    onClose()
  }

  const handleReset = () => {
    setDraft(null)
    onReset()
    onClose()
  }

  return (
    <ReportAltSettingsDrawer
      open={open}
      onClose={onClose}
      meta={meta}
      draft={draft}
      onDraftChange={setDraft}
      onApply={handleApply}
      onReset={handleReset}
    />
  )
}

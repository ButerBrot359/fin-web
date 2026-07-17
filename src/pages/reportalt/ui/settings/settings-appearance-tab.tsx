import { Checkbox, FormControlLabel } from '@mui/material'

import type { ReportAltAppearanceFlagDto } from '../../types/reportalt'

interface SettingsAppearanceTabProps {
  /** Флажки оформления (из meta либо встроенный highlightNegatives). */
  flagDefs: ReportAltAppearanceFlagDto[]
  /** Дельта пользователя: только тронутые флажки. */
  flags: Record<string, boolean>
  onChange: (flags: Record<string, boolean>) => void
  isKz: boolean
}

/**
 * Вкладка «Оформление» (settings-design §7): чекбоксы флажков-параметров
 * («Выделять отрицательные красным» и что придёт в meta). Нетронутый флажок
 * показывает дефолт варианта и в дельту не попадает.
 */
export const SettingsAppearanceTab = ({
  flagDefs,
  flags,
  onChange,
  isKz,
}: SettingsAppearanceTabProps) => (
  <div className="flex flex-col">
    {flagDefs.map((def) => {
      // Нетронутый флажок показывает дефолт варианта (defaultValue).
      const checked =
        def.code in flags ? flags[def.code] : (def.defaultValue ?? false)
      return (
        <FormControlLabel
          key={def.code}
          control={
            <Checkbox
              size="small"
              checked={checked}
              onChange={(e) => {
                onChange({ ...flags, [def.code]: e.target.checked })
              }}
            />
          }
          label={(isKz ? def.titleKz : def.titleRu) || def.titleRu}
        />
      )
    })}
  </div>
)

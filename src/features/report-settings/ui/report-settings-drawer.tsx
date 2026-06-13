import {
  Checkbox,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

/** Один переключаемый пункт группировки (измерение или вид субконто). */
export interface ReportGroupItem {
  key: string
  label: string
  checked: boolean
}

interface ReportSettingsDrawerProps {
  open: boolean
  onClose: () => void
  /** Пункты вкладки «Группировка» (измерения + виды субконто). */
  groupItems: ReportGroupItem[]
  /** Переключить видимость группы по ключу. */
  onToggleGroup: (key: string) => void
}

/**
 * Боковая панель «Настройки» отчёта (как в 1С). Пока одна вкладка —
 * «Группировка»: чекбоксы измерений/видов субконто, которые показывать в
 * аналитике. Переиспользуется отчётами (карточка счёта, ОСВ).
 */
export const ReportSettingsDrawer = ({
  open,
  onClose,
  groupItems,
  onToggleGroup,
}: ReportSettingsDrawerProps) => {
  const { t } = useTranslation()

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

        <Typography variant="subtitle2" className="text-ui-05">
          {t('reportSettings.grouping')}
        </Typography>
        <div className="flex flex-col">
          {groupItems.map((item) => (
            <FormControlLabel
              key={item.key}
              control={
                <Checkbox
                  size="small"
                  checked={item.checked}
                  onChange={() => {
                    onToggleGroup(item.key)
                  }}
                />
              }
              label={item.label}
            />
          ))}
        </div>
      </div>
    </Drawer>
  )
}

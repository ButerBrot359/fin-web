import { useState } from 'react'
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

/** Один переключаемый пункт (измерение, вид субконто или показатель). */
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
  /** Пункты вкладки «Показатели» (Сумма / Количество / …). Опционально. */
  indicatorItems?: ReportGroupItem[]
  onToggleIndicator?: (key: string) => void
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
 * (измерения/виды субконто) и, опционально, «Показатели» (Сумма/Количество).
 * Переиспользуется отчётами (карточка счёта, ОСВ).
 */
export const ReportSettingsDrawer = ({
  open,
  onClose,
  groupItems,
  onToggleGroup,
  indicatorItems,
  onToggleIndicator,
}: ReportSettingsDrawerProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)

  const hasIndicators =
    indicatorItems != null &&
    indicatorItems.length > 0 &&
    onToggleIndicator != null

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

        {hasIndicators ? (
          <>
            <Tabs
              value={tab}
              onChange={(_e, v: number) => {
                setTab(v)
              }}
              variant="fullWidth"
            >
              <Tab label={t('reportSettings.grouping')} />
              <Tab label={t('reportSettings.indicators')} />
            </Tabs>
            {tab === 0 ? (
              <CheckboxList items={groupItems} onToggle={onToggleGroup} />
            ) : (
              <CheckboxList
                items={indicatorItems}
                onToggle={onToggleIndicator}
              />
            )}
          </>
        ) : (
          <>
            <Typography variant="subtitle2" className="text-ui-05">
              {t('reportSettings.grouping')}
            </Typography>
            <CheckboxList items={groupItems} onToggle={onToggleGroup} />
          </>
        )}
      </div>
    </Drawer>
  )
}

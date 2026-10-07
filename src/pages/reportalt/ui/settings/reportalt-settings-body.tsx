import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Divider, Tab, Tabs } from '@mui/material'

import {
  useReportAltSettingsTabs,
  type ReportAltSettingsTabsProps,
} from './use-reportalt-settings-tabs'

export interface ReportAltSettingsBodyProps extends ReportAltSettingsTabsProps {
  onApply: () => void
  onReset: () => void
  fillHeight?: boolean
}

export const ReportAltSettingsBody = ({
  onApply,
  onReset,
  fillHeight = false,
  ...tabsProps
}: ReportAltSettingsBodyProps) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)
  const tabs = useReportAltSettingsTabs(tabsProps)
  const activeTab = Math.min(tab, Math.max(tabs.length - 1, 0))

  return (
    <>
      <Tabs
        value={activeTab}
        onChange={(_e, v: number) => {
          setTab(v)
        }}
        variant={fillHeight ? 'fullWidth' : 'scrollable'}
        scrollButtons={fillHeight ? undefined : 'auto'}
      >
        {tabs.map((tb) => (
          <Tab
            key={tb.key}
            label={tb.label}
            sx={{ minWidth: 0, px: 1, textTransform: 'none' }}
          />
        ))}
      </Tabs>

      <div className={fillHeight ? 'min-h-0 grow overflow-auto' : 'pt-2'}>
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
    </>
  )
}

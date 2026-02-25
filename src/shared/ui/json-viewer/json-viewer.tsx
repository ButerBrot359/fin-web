import { useState } from 'react'
import { Drawer, IconButton, Tab, Tabs, Typography } from '@mui/material'
import { cn } from '@/shared/lib/utils/cn'

interface JsonTab {
  label: string
  data: unknown
}

interface JsonViewerProps {
  tabs: JsonTab[]
  open: boolean
  onClose: () => void
}

export const JsonViewer = ({ tabs, open, onClose }: JsonViewerProps) => {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { className: 'w-[600px] max-w-[80vw]' },
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-ui-03 px-4 py-2">
          <Typography variant="subtitle1" fontWeight={600}>
            JSON
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <span className="text-lg">✕</span>
          </IconButton>
        </div>

        <Tabs
          value={activeTab}
          onChange={(_, val: number) => {
            setActiveTab(val)
          }}
          className="border-b border-ui-03 px-4"
        >
          {tabs.map((tab) => (
            <Tab key={tab.label} label={tab.label} />
          ))}
        </Tabs>

        <div className="flex-1 overflow-auto p-4">
          <pre
            className={cn(
              'rounded-lg bg-ui-01 p-4 text-xs leading-relaxed',
              'overflow-auto font-mono whitespace-pre-wrap wrap-break-word'
            )}
          >
            {JSON.stringify(tabs[activeTab]?.data ?? null, null, 2)}
          </pre>
        </div>
      </div>
    </Drawer>
  )
}

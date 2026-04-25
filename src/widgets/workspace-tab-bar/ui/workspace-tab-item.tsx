import { Typography } from '@mui/material'

import type { WorkspaceTab } from '@/features/workspace-tabs'

import CrossIcon from '@/shared/assets/icons/cross.svg'

interface WorkspaceTabItemProps {
  tab: WorkspaceTab
  isActive: boolean
  onActivate: () => void
  onClose: (e: React.MouseEvent) => void
}

export const WorkspaceTabItem = ({
  tab,
  isActive,
  onActivate,
  onClose,
}: WorkspaceTabItemProps) => {
  const displayTitle = tab.isDirty ? `${tab.title} *` : tab.title

  return (
    <button
      type="button"
      onClick={onActivate}
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border-none py-2 pr-1.5 pl-3 ${
        isActive ? 'bg-ui-01' : 'bg-ui-04'
      }`}
    >
      <Typography
        variant="body1"
        className="whitespace-nowrap text-ui-06"
        sx={{ fontSize: '16px', fontWeight: 500 }}
      >
        {displayTitle || '\u00A0'}
      </Typography>
      <span
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClose(e as unknown as React.MouseEvent)
        }}
        className="flex shrink-0 items-center justify-center opacity-60 hover:opacity-100"
      >
        <CrossIcon className="size-4" />
      </span>
    </button>
  )
}

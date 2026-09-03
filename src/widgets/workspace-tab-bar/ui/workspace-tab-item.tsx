import { Typography } from '@mui/material'

import type { WorkspaceTab } from '@/features/workspace-tabs'
import { useFormCacheStore } from '@/features/workspace-tabs'
import { cn } from '@/shared/lib/utils/cn'

import CrossIcon from '@/shared/assets/icons/cross.svg'

interface WorkspaceTabItemProps {
  tab: WorkspaceTab
  isActive: boolean
  onActivate: () => void
  onClose: (e: React.MouseEvent) => void
}

// Состояния по компонент-шиту Figma «Tab» (58:1107): активная — тёмная с
// белым текстом; неактивная — белая с тёмным; ховер неактивной — синий текст;
// ховер активной — светло-голубая с тёмным текстом. Крестик закрытия виден
// только при наведении (вариант Icon=Right шита).
const tabStyles = (isActive: boolean) =>
  cn(
    'group flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border-none pr-1.5 pl-3 transition-colors',
    isActive
      ? 'bg-ui-06 text-ui-01 hover:bg-ui-04 hover:text-ui-06'
      : 'bg-ui-01 text-ui-06 hover:text-accent-02'
  )

export const WorkspaceTabItem = ({
  tab,
  isActive,
  onActivate,
  onClose,
}: WorkspaceTabItemProps) => {
  const isDirty = useFormCacheStore((s) => {
    const entry = s.cache[tab.id]
    return entry ? entry.isDirty : false
  })
  const displayTitle = isDirty ? `${tab.title} *` : tab.title

  return (
    <button type="button" onClick={onActivate} className={tabStyles(isActive)}>
      <Typography
        variant="body1"
        className="whitespace-nowrap text-inherit"
        sx={{ fontSize: '16px', fontWeight: 500, color: 'inherit' }}
      >
        {displayTitle || ' '}
      </Typography>
      <span
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onClose(e as unknown as React.MouseEvent)
        }}
        className="hidden shrink-0 items-center justify-center group-hover:flex"
      >
        <CrossIcon className="size-4" />
      </span>
    </button>
  )
}

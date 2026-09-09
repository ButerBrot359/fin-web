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

// Вид по низу рабочих макетов Figma (ПКО 167:5013 и др.): активная вкладка —
// светло-голубая (UI 04) с тёмным текстом, неактивные белые, крестик виден у
// всех всегда; ховер неактивной — синий текст (компонент-шит Tab 58:1107).
const tabStyles = (isActive: boolean) =>
  cn(
    'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border-none pr-1.5 pl-3 transition-colors',
    isActive
      ? 'bg-ui-04 text-ui-06'
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
        className="flex shrink-0 items-center justify-center opacity-60 hover:opacity-100"
      >
        <CrossIcon className="size-4" />
      </span>
    </button>
  )
}

import type { HTMLAttributes } from 'react'
import { Paper } from '@mui/material'

import { cssVar, shadows } from '@/shared/design/tokens'

interface FooterButtonsProps {
  onShowAll?: () => void
  onAdd?: () => void
  showAllLabel: string
  addLabel: string
}

export function createFooterPaper({
  onShowAll,
  onAdd,
  showAllLabel,
  addLabel,
}: FooterButtonsProps) {
  function FooterPaper(props: HTMLAttributes<HTMLDivElement>) {
    return (
      <Paper
        {...props}
        sx={{
          borderRadius: '8px',
          boxShadow: cssVar(shadows.popup),
          overflow: 'hidden',
        }}
      >
        {props.children}
        <div className="flex items-center justify-between border-t border-ui-04 py-3">
          {onShowAll && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onShowAll()
              }}
              className="cursor-pointer rounded-lg px-4 py-2.5 text-body1 font-medium text-accent-02"
            >
              {showAllLabel}
            </button>
          )}
          {onAdd && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onAdd()
              }}
              className="cursor-pointer rounded-lg px-4 py-2.5 text-body1 font-medium text-accent-02"
            >
              {addLabel}
            </button>
          )}
        </div>
      </Paper>
    )
  }
  return FooterPaper
}

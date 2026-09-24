import type { FC } from 'react'
import { Typography } from '@mui/material'

import { cssVar, palette } from '@/shared/design/tokens'

export const ReportNoteLines: FC<{ lines?: string[] }> = ({ lines }) => {
  if (!lines || lines.length === 0) return null
  return (
    <div className="mt-4 flex flex-col gap-1" data-testid="report-note-lines">
      {lines.map((line, i) => (
        <Typography
          key={i}
          variant="body2"
          sx={{ color: cssVar(palette.pendingText1), whiteSpace: 'pre-wrap' }}
        >
          {line}
        </Typography>
      ))}
    </div>
  )
}

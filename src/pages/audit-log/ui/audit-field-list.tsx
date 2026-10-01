import type { ReactNode } from 'react'
import { Typography } from '@mui/material'

export interface AuditField {
  label: string
  value: ReactNode
}

interface AuditFieldListProps {
  title: string
  fields: AuditField[]
}

/** Раздел карточки события: заголовок и пары «поле — значение» в две колонки. */
export const AuditFieldList = ({ title, fields }: AuditFieldListProps) => (
  <section className="flex flex-col gap-3">
    <Typography component="h3" variant="h6" fontWeight={700}>
      {title}
    </Typography>
    <dl className="m-0 grid grid-cols-[200px_1fr] gap-x-4 gap-y-2">
      {fields.map((field) => (
        <div key={field.label} className="contents">
          <Typography component="dt" variant="body2" color="text.secondary">
            {field.label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            className="m-0"
            sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}
          >
            {field.value}
          </Typography>
        </div>
      ))}
    </dl>
  </section>
)

import type { FC } from 'react'
import { Box } from '@mui/material'

interface RequiredMarkProps {
  label: string
}

/**
 * Заголовок обязательной колонки ТЧ: label + красный «*» (SCRUM-329),
 * визуально как MUI-астериск обязательного поля шапки.
 */
export const RequiredMark: FC<RequiredMarkProps> = ({ label }) => (
  <Box component="span">
    {label}
    <Box component="span" aria-hidden sx={{ color: 'error.main', ml: '2px' }}>
      *
    </Box>
  </Box>
)

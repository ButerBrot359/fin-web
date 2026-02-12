import type { ReactNode } from 'react'
import { StyledEngineProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { ru } from 'date-fns/locale'

interface MuiProviderProps {
  children: ReactNode
}

export const MuiProvider = ({ children }: MuiProviderProps) => {
  return (
    <StyledEngineProvider injectFirst>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
        {children}
      </LocalizationProvider>
    </StyledEngineProvider>
  )
}

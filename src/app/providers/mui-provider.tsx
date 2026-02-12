import type { ReactNode } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { ru } from 'date-fns/locale'

const theme = createTheme({
  typography: {
    fontFamily: "'Google Sans', system-ui, sans-serif",
    h2: { fontSize: '26px', fontWeight: 700 },
    h3: { fontSize: '20px', fontWeight: 700 },
    body1: { fontSize: '16px', fontWeight: 500 },
    body2: { fontSize: '14px', fontWeight: 500 },
  },
  palette: {
    background: {
      default: '#ffffff',
      paper: '#f2f6fd',
    },
    primary: {
      main: '#2a75f4',
    },
    secondary: {
      main: '#daf449',
    },
    error: {
      main: '#f4482a',
    },
    text: {
      primary: '#222124',
      secondary: '#9fa9ba',
    },
  },
})

interface MuiProviderProps {
  children: ReactNode
}

export function MuiProvider({ children }: MuiProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru}>
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  )
}

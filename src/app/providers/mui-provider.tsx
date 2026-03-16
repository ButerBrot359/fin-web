import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StyledEngineProvider } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

import type { Locale } from 'date-fns'
import { ru, kk } from 'date-fns/locale'

import { theme } from '@/app/theme/theme'
import type { SupportedLanguage } from '@/app/config/i18n'

const dateFnsLocales: Record<SupportedLanguage, Locale> = {
  ru,
  kz: kk,
}

interface MuiProviderProps {
  children: ReactNode
}

export const MuiProvider = ({ children }: MuiProviderProps) => {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const locale =
    lang in dateFnsLocales ? dateFnsLocales[lang as SupportedLanguage] : ru

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={AdapterDateFns}
          adapterLocale={locale}
        >
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}

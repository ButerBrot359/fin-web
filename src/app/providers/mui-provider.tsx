import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { StyledEngineProvider } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { kzKZ, ruRU } from '@mui/x-date-pickers/locales'
import type { PickersLocaleText } from '@mui/x-date-pickers/locales'

import type { Locale } from 'date-fns'
import { ru, kk } from 'date-fns/locale'

import { theme } from '@/app/theme/theme'
import type { SupportedLanguage } from '@/app/config/i18n'

const dateFnsLocales: Record<SupportedLanguage, Locale> = {
  ru,
  kz: kk,
}

const pickerLocaleTexts: Record<
  SupportedLanguage,
  Partial<PickersLocaleText>
> = {
  ru: ruRU.components.MuiLocalizationProvider.defaultProps.localeText,
  kz: kzKZ.components.MuiLocalizationProvider.defaultProps.localeText,
}

interface MuiProviderProps {
  children: ReactNode
}

export const MuiProvider = ({ children }: MuiProviderProps) => {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const language: SupportedLanguage =
    lang in dateFnsLocales ? (lang as SupportedLanguage) : 'ru'
  const locale = dateFnsLocales[language]

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={AdapterDateFns}
          adapterLocale={locale}
          localeText={pickerLocaleTexts[language]}
        >
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}

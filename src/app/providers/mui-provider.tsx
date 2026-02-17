import type { ReactNode } from 'react'
import { StyledEngineProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { useTranslation } from 'react-i18next'
import type { Locale } from 'date-fns'
import { ru, enUS, kk } from 'date-fns/locale'
import type { SupportedLanguage } from '@/app/config/i18n'

const dateFnsLocales: Record<SupportedLanguage, Locale> = {
  ru,
  en: enUS,
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
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
        {children}
      </LocalizationProvider>
    </StyledEngineProvider>
  )
}

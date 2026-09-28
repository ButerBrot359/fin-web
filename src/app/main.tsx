import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from '@/app/config/i18n'
import { ensureUiTranslations, isKzLanguage } from '@/shared/lib/i18n'
import { QueryProvider } from './providers/query-provider'
import { MuiProvider } from './providers/mui-provider'
import { injectDesignTokens } from '@/shared/design/inject-design-tokens'
import { startLocalIpDetection } from '@/shared/lib/client-context'
import './index.css'
import App from './App'

injectDesignTokens()

// Локальные адреса компьютера для журнала регистрации (SCRUM-371): один раз на загрузку, не
// блокируя старт — первые запросы уйдут без X-Client-Local-Ip, это нормально.
void startLocalIpDetection()

const rootElement = document.getElementById('root')

const render = () => {
  if (!rootElement) return
  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <MuiProvider>
          <App />
        </MuiProvider>
      </QueryProvider>
    </StrictMode>
  )
}

const uiTranslations = ensureUiTranslations()

if (isKzLanguage(i18n.language)) {
  void uiTranslations.finally(render)
} else {
  render()
}

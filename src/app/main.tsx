import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/app/config/i18n'
import { QueryProvider } from './providers/query-provider'
import { MuiProvider } from './providers/mui-provider'
import { injectDesignTokens } from '@/shared/design/inject-design-tokens'
import './index.css'
import App from './App'

injectDesignTokens()

const rootElement = document.getElementById('root')

if (rootElement) {
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

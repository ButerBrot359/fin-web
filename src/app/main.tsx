import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryProvider } from './providers/query-provider'
import './index.css'
import App from './App'

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryProvider>
        <App />
      </QueryProvider>
    </StrictMode>
  )
}

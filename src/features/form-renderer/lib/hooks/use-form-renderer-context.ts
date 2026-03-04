import { createContext, useContext } from 'react'

import type { FormRendererContextValue } from '../../types/renderer-context'

export const FormRendererContext =
  createContext<FormRendererContextValue | null>(null)

export const useFormRendererContext = () => {
  const context = useContext(FormRendererContext)
  if (!context) {
    throw new Error(
      'useFormRendererContext must be used within FormRendererProvider'
    )
  }
  return context
}

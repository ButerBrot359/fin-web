import { createContext } from 'react'

export interface CheckAllActions {
  onCheckAll: () => void
  onUncheckAll: () => void
  checkAllLabel: string
  uncheckAllLabel: string
}

export const CheckAllActionsContext = createContext<CheckAllActions | null>(
  null
)

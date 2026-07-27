import { createContext, useContext } from 'react'

import type { ViewNode } from '../../types/view'

interface OverflowContextValue {
  /** Узлы командной панели, свёрнутые в меню «Ещё» (FE-5). */
  collapsedNodes: ViewNode[]
}

export const OverflowContext = createContext<OverflowContextValue>({
  collapsedNodes: [],
})

export const useOverflowCollapsed = (): ViewNode[] =>
  useContext(OverflowContext).collapsedNodes

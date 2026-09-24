import type { FC, ReactNode } from 'react'

import { useAppShellSidebar } from '../lib/shell/use-app-shell-sidebar'
import { NodeRenderer } from './node-renderer'

interface ShellSidebarHostProps {
  // Легаси-сайдбар подаётся пропом из app/ (изоляция SDUI↔легаси): показывается,
  // пока бэк APP_SHELL недоступен/грузится — регресса нет до выкатки (дизайн §4).
  fallback: ReactNode
}

export const ShellSidebarHost: FC<ShellSidebarHostProps> = ({ fallback }) => {
  const { sidebarNode, isPending, isError } = useAppShellSidebar()

  if (isPending || isError || !sidebarNode) return <>{fallback}</>
  return <NodeRenderer node={sidebarNode} />
}

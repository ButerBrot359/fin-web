import type { FC, ReactNode } from 'react'

import { useAppShellSidebar } from '../lib/shell/use-app-shell-sidebar'
import { MenuSettingsEntryButton } from './menu-settings/menu-settings-entry-button'
import { NodeRenderer } from './node-renderer'

interface ShellSidebarHostProps {
  // Легаси-сайдбар подаётся пропом из app/ (изоляция SDUI↔легаси): показывается,
  // пока бэк APP_SHELL недоступен/грузится — регресса нет до выкатки (дизайн §4).
  fallback: ReactNode
}

export const ShellSidebarHost: FC<ShellSidebarHostProps> = ({ fallback }) => {
  const { sidebarNode, isPending, isError } = useAppShellSidebar()

  if (isPending || isError || !sidebarNode) return <>{fallback}</>
  // Кнопка «Настроить меню» (SCRUM-426) — вход в личную настройку для всех;
  // живёт под SDUI-деревом сайдбара, само дерево не трогаем.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NodeRenderer node={sidebarNode} />
      </div>
      <MenuSettingsEntryButton />
    </div>
  )
}

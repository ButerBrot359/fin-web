import type { ViewNode } from '../types/view'
import { viewTransport } from './view-transport'

// OPEN оболочки: layoutCode:"APP_SHELL" (route-независимо; после мёржа задачи 8
// бэк принимает явный layoutCode — backend-answers-SCRUM-289-shell.md §1).
// viewTransport сам добавляет language из i18n.
export async function fetchAppShellTree(): Promise<ViewNode | null> {
  const res = await viewTransport.post({
    formSessionId: null,
    revision: null,
    layoutCode: 'APP_SHELL',
    action: { type: 'OPEN', layoutCode: 'APP_SHELL' },
  })
  return res.tree ?? null
}

// DFS-поиск узла SIDEBAR в дереве APP_SHELL.
export function findSidebarNode(root: ViewNode | null): ViewNode | null {
  if (!root) return null
  if (root.type === 'SIDEBAR') return root
  for (const child of root.children ?? []) {
    const found = findSidebarNode(child)
    if (found) return found
  }
  return null
}

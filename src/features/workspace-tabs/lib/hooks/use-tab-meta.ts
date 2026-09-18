import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

export function useTabMeta(title: string, tabId?: string) {
  const { pathname } = useLocation()
  const setTabTitle = useWorkspaceTabsStore((s) => s.setTabTitle)

  // Вкладку ищем по ТЕКУЩЕМУ маршруту, а не запоминаем на монтировании.
  // SDUI-экран (SduiCardScreen) монтируется один раз на всё приложение
  // (SCRUM-360 этап B), поэтому запомненный id навсегда оставался бы первым
  // открытым: заголовки всех следующих экранов уходили бы в чужую вкладку.
  // Переход «новый документ → записанный» (/new → /:id) при этом не ломается:
  // id вкладки не меняется, меняется её path (updateTabPath), и поиск по path
  // возвращает ту же вкладку.
  const resolvedId = useWorkspaceTabsStore(
    (s) => tabId ?? s.tabs.find((t) => t.path === pathname)?.id ?? pathname
  )

  useEffect(() => {
    if (resolvedId && title) {
      setTabTitle(resolvedId, title)
    }
  }, [resolvedId, title, setTabTitle])
}

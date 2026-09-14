import { useEffect, type FC } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import { useTreeStore } from '../lib/stores/tree-store'

/**
 * Редактор формы из админки конструктора: админка ведёт на реальный роут формы
 * с параметром `?adminCustomize=all|<ключ профиля>` — как только экран открылся,
 * поверх автоматически поднимается диалог «Изменить форму для всех» с
 * предвыбранным слоем. После закрытия диалога админ ОСТАЁТСЯ на форме —
 * посмотреть результат и уйти, когда сам решит (решение владельца 15.09:
 * автовозврат в админку сбрасывал форму из-под ног).
 * Вложить SduiScreen прямо в страницу админки нельзя — react-router запрещает
 * второй Router, а весь SDUI-конвейер живёт роутом.
 */

/**
 * «Уже открывали» — модульный синглтон, а не ref/state: на re-OPEN после
 * сохранения SduiScreen показывает скелетон и РАЗМОНТИРУЕТ детей, ref
 * обнулялся и диалог открывался повторно. Сбрасывается админкой на входе
 * (resetAdminCustomizeAutoOpen), чтобы повторный клик по той же форме работал.
 */
let lastAutoOpenKey: string | null = null

export function resetAdminCustomizeAutoOpen(): void {
  lastAutoOpenKey = null
}

export const AdminCustomizeAutoOpen: FC = () => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const target = searchParams.get('adminCustomize')
  const screenKey = useTreeStore((s) => s.screenKey)
  const openDialog = useCustomizeFormStore((s) => s.open)

  // Диалог открываем только когда пришёл screenKey ИМЕННО этой формы: на
  // монтировании tree-store ещё держит ключ предыдущего экрана.
  const typeCode = /\/documents\/([^/]+)\//.exec(location.pathname)?.[1]
  const screenReady =
    screenKey != null &&
    typeCode != null &&
    screenKey.startsWith(`${typeCode}.`)

  const autoOpenKey = `${location.pathname}|${target ?? ''}`

  useEffect(() => {
    if (target != null && screenReady && lastAutoOpenKey !== autoOpenKey) {
      lastAutoOpenKey = autoOpenKey
      openDialog('default', target === 'all' ? '' : target)
    }
  }, [target, screenReady, autoOpenKey, openDialog])

  return null
}

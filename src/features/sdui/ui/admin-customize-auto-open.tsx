import { useEffect, type FC } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import { useTreeStore } from '../lib/stores/tree-store'

/**
 * Редактор формы из админки конструктора: админка ведёт на реальный роут формы
 * с параметром `?adminCustomize=all|<ключ профиля>` — как только экран открылся,
 * поверх автоматически поднимается диалог «Изменить форму для всех» с
 * предвыбранным слоем. «Сохранить» диалог НЕ закрывает (слой применяется, форма
 * под диалогом перерисовывается, админ продолжает настраивать); закрытие
 * диалога — явный выход, он возвращает в админку (решение владельца 15.09).
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

/** Для какого ключа диалог реально был открыт — переход «открыт → закрыт»
 *  означает явный выход и возврат в админку. Тоже модульный: переживает
 *  remount на скелетоне. */
let sawOpenKey: string | null = null

export function resetAdminCustomizeAutoOpen(): void {
  lastAutoOpenKey = null
  sawOpenKey = null
}

export const AdminCustomizeAutoOpen: FC = () => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const target = searchParams.get('adminCustomize')
  const screenKey = useTreeStore((s) => s.screenKey)
  const openDialog = useCustomizeFormStore((s) => s.open)
  const dialogOpen = useCustomizeFormStore((s) => s.isOpen)

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

  // Возврат в админку — только на переходе «был открыт → закрыт» (sawOpenKey):
  // на монтировании и на скелетоне между re-OPEN диалог формально закрыт/
  // размонтирован, и без этого маркера назад уводило бы преждевременно.
  useEffect(() => {
    if (target == null) return
    if (dialogOpen) {
      sawOpenKey = autoOpenKey
      return
    }
    if (sawOpenKey === autoOpenKey) {
      sawOpenKey = null
      void navigate(-1)
    }
  }, [target, dialogOpen, autoOpenKey, navigate])

  return null
}

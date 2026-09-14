import { useEffect, useRef, type FC } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import { useTreeStore } from '../lib/stores/tree-store'

/**
 * Редактор формы из админки конструктора: админка ведёт на реальный роут формы
 * с параметром `?adminCustomize=all|<ключ профиля>` — как только экран открылся,
 * поверх автоматически поднимается диалог «Изменить форму для всех» с
 * предвыбранным слоем, а его закрытие возвращает в админку (история назад).
 * Вложить SduiScreen прямо в страницу админки нельзя — react-router запрещает
 * второй Router, а весь SDUI-конвейер живёт роутом.
 */
export const AdminCustomizeAutoOpen: FC = () => {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const target = searchParams.get('adminCustomize')
  const screenKey = useTreeStore((s) => s.screenKey)
  const dialogOpen = useCustomizeFormStore((s) => s.isOpen)
  const openDialog = useCustomizeFormStore((s) => s.open)
  // ref, а не state: флаги нужны только эффектам, ре-рендер не требуется.
  const shownRef = useRef(false)
  const sawOpenRef = useRef(false)

  // Диалог открываем только когда пришёл screenKey ИМЕННО этой формы: на
  // монтировании tree-store ещё держит ключ предыдущего экрана.
  const typeCode = /\/documents\/([^/]+)\//.exec(location.pathname)?.[1]
  const screenReady =
    screenKey != null &&
    typeCode != null &&
    screenKey.startsWith(`${typeCode}.`)

  useEffect(() => {
    if (target != null && !shownRef.current && screenReady) {
      shownRef.current = true
      openDialog('default', target === 'all' ? '' : target)
    }
  }, [target, screenReady, openDialog])

  // Назад — только на переходе «диалог был открыт → закрылся»: проверка по
  // одному лишь флагу открытия гонялась с эффектом выше в том же коммите и
  // уводила назад до первого рендера диалога.
  useEffect(() => {
    if (target == null) return
    if (dialogOpen) {
      sawOpenRef.current = true
      return
    }
    if (sawOpenRef.current) {
      void navigate(-1)
    }
  }, [target, dialogOpen, navigate])

  return null
}

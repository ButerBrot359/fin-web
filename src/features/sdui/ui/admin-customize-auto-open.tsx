import { useEffect, useRef, type FC } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

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
  const navigate = useNavigate()
  const target = searchParams.get('adminCustomize')
  const screenKey = useTreeStore((s) => s.screenKey)
  const dialogOpen = useCustomizeFormStore((s) => s.isOpen)
  const openDialog = useCustomizeFormStore((s) => s.open)
  // ref, а не state: флаг нужен только эффектам, ре-рендер не требуется.
  const shownRef = useRef(false)

  useEffect(() => {
    if (target != null && !shownRef.current && screenKey != null) {
      shownRef.current = true
      openDialog('default', target === 'all' ? '' : target)
    }
  }, [target, screenKey, openDialog])

  useEffect(() => {
    if (target != null && shownRef.current && !dialogOpen) {
      void navigate(-1)
    }
  }, [target, dialogOpen, navigate])

  return null
}

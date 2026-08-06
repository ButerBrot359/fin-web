import { useState, useEffect } from 'react'

import type { ViewNode } from '../../types/view'
import {
  registerRevealErrors,
  unregisterRevealErrors,
} from '../table-validation-registry'

export interface UseTableValidationResult {
  revealErrors: boolean
}

/**
 * Клиентская валидация обязательных ячеек ТЧ (SCRUM-329). Держит флаг
 * revealErrors: false до сабмита, true после write-команды (dispatch зовёт
 * revealAllTableErrors). Регистрация — как registerPendingFlush, эффект по
 * node.binding; на новом OPEN таблица перемонтируется и флаг сбрасывается.
 */
export function useTableValidation(node: ViewNode): UseTableValidationResult {
  const [revealErrors, setRevealErrors] = useState(false)

  useEffect(() => {
    if (!node.binding) return
    const token = registerRevealErrors(() => {
      setRevealErrors(true)
    })
    return () => {
      unregisterRevealErrors(token)
    }
  }, [node.binding])

  return { revealErrors }
}

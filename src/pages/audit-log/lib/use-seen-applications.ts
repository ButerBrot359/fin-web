import { useState } from 'react'

import type { AuditLogRecord } from '../api/audit-log-api'

/**
 * Варианты отбора «Приложение» — те, что уже встречались в загруженных строках.
 * Отдельного справочника приложений в контракте нет, а заставлять набирать код руками хуже, чем
 * предложить увиденное. Список копится за время жизни страницы: сузили отбор до одного
 * приложения — остальные из выпадашки не пропадают.
 */
export const useSeenApplications = (
  rows: AuditLogRecord[]
): Record<string, string> => {
  const [seen, setSeen] = useState<Record<string, string>>({})

  const fresh = rows.filter(
    (row): row is AuditLogRecord & { application: string } =>
      !!row.application && !(row.application in seen)
  )
  // Подстройка состояния во время рендера, а не эффект: без лишнего кадра и каскада рендеров.
  // Сходится за один шаг — после добавления «новых» больше нет.
  if (fresh.length > 0) {
    setSeen((previous) => {
      const next = { ...previous }
      for (const row of fresh) {
        next[row.application] = row.applicationPresentation ?? row.application
      }
      return next
    })
  }

  return seen
}

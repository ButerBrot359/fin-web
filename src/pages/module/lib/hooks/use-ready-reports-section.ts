import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ModuleElementType } from '@/entities/module'
import type { ModuleSection } from '@/entities/module'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { fetchReportsList } from '@/pages/reports/report-list'

/**
 * Модуль, в который добавляется подраздел «Готовые отчёты».
 * В нём собираются все реализованные (status=ACTIVE) отчёты домена `/api/reports`.
 */
const ADMIN_MODULE_CODE = 'Administrirovanie'

/**
 * Строит подраздел «Готовые отчёты» для модуля «Администрирование».
 *
 * <p>Берёт список всех ACTIVE-отчётов из `/api/reports` (а не из статичного
 * `/api/settings/modules`), поэтому коды всегда рабочие, а список пополняется
 * автоматически по мере активации новых отчётов. Каждый элемент — тип `Report`,
 * ссылка ведёт на универсальную страницу отчёта `/modules/Administrirovanie/report/{code}`.
 *
 * @returns секцию для вставки в {@link ModuleItems}, либо `null` — если это не
 *          модуль администрирования или отчётов нет.
 */
export function useReadyReportsSection(pageCode: string): ModuleSection | null {
  const { i18n } = useTranslation()
  const isAdmin = pageCode === ADMIN_MODULE_CODE

  const { data } = useQuery({
    queryKey: ['ready-reports-section'],
    queryFn: ({ signal }) => fetchReportsList({ status: 'ACTIVE' }, signal),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo<ModuleSection | null>(() => {
    if (!isAdmin) return null
    const list = data?.data.list ?? []
    if (list.length === 0) return null

    const elements = [...list]
      .sort((a, b) =>
        getLocalizedName(a, i18n.language).localeCompare(
          getLocalizedName(b, i18n.language),
          'ru',
          { numeric: true }
        )
      )
      .map((r) => ({
        code: r.code,
        type: ModuleElementType.Report,
        domainKind: null,
        nameRu: r.nameRu,
        nameKz: r.nameKz,
      }))

    return {
      nameRu: 'Готовые отчёты',
      nameKz: 'Дайын есептер',
      elements,
    }
  }, [isAdmin, data, i18n.language])
}

import { useMemo } from 'react'

import type { ViewNode } from '../../types/view'
import { useSduiSession } from '../sdui-session-context'
import { sumVisibleFooter } from '../utils/table-footer'
import { useExternalRowFilterDeclared } from './use-external-row-filter'
import type { TableRow } from './use-table-sync'

/**
 * Значения подвала ТЧ: серверные итоги (`<binding>.footer`), а при объявленном
 * внешнем отборе строк — поверх них клиентская сумма по ВИДИМОМУ набору
 * (см. sumVisibleFooter): серверный итог посчитан по всем строкам и для
 * отфильтрованной витрины неверен.
 */
export function useTableFooterValues(
  node: ViewNode,
  visibleRows: TableRow[]
): Record<string, unknown> | undefined {
  const { getValue } = useSduiSession()
  const externalFilterDeclared = useExternalRowFilterDeclared(node)

  const serverFooter = node.binding
    ? (getValue(node.binding + '.footer') as
        | Record<string, unknown>
        | undefined)
    : undefined

  return useMemo(() => {
    if (!externalFilterDeclared || !serverFooter) return serverFooter
    return { ...serverFooter, ...sumVisibleFooter(node.children, visibleRows) }
  }, [externalFilterDeclared, serverFooter, node.children, visibleRows])
}

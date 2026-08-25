import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, TableCell, TableRow, Typography } from '@mui/material'

import type { PagedTableRows } from '../../../lib/hooks/use-paged-table-rows'

/**
 * Футер PAGED-таблицы (SCRUM-368): сентинел бесконечного скролла либо кнопка
 * «Показать ещё» + индикатор догрузки. PAGER-режима на фронте нет (делаем,
 * только если бэк его реально выберет — v1 §3.1) — до тех пор деградирует
 * до кнопки.
 */
export const PagedTableFooter: FC<{
  state: PagedTableRows<unknown>
  colSpan: number
}> = ({ state, colSpan }) => {
  const { t } = useTranslation()
  const {
    paged,
    loadTrigger,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    attachSentinel,
  } = state
  if (!paged) return null
  if (!hasNextPage && !isFetchingNextPage) return null

  const infinite = loadTrigger === 'INFINITE_SCROLL'
  const showButton = !infinite && hasNextPage && !isFetchingNextPage

  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ border: 0, py: 1 }}>
        {infinite && hasNextPage && (
          <div ref={attachSentinel} aria-hidden="true" />
        )}
        {isFetchingNextPage && (
          <Typography variant="body2" color="text.secondary">
            {t('sdui.loading')}
          </Typography>
        )}
        {showButton && (
          <Button size="small" onClick={fetchNextPage}>
            {t('sdui.pagination.showMore')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

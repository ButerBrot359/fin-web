import { useTranslation } from 'react-i18next'
import { Button, Typography } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'
import { useVirtualBlocks } from '@/shared/lib/virtual-rows/use-virtual-blocks'
import { ShimmerBlock } from '@/shared/ui/page-skeleton/page-skeleton'

import type { NodeProps } from '../../../types/view'
import { usePagedTableRows } from '../../../lib/hooks/use-paged-table-rows'
import { readVirtualization } from '../../../lib/utils/pagination'
import {
  type AccountingRow,
  buildBlockModel,
  collectColumnLabels,
  collectGroupLabels,
} from './accounting-block-logic'
import { BlockRow, bl } from './accounting-block-row'

// Журнал проводок бухрегистра в раскладке 1С. Раскладка СКОПИРОВАНА из легаси
// accounting-postings-table.tsx (импортов из легаси нет — правило изоляции):
// проводка — блок из N строк (обычно 3), аналитика Дт/Кт в двух группах
// колонок, метки полей — в многорядной шапке, в строках только значения.
// Метки шапки — из props.label листьев дерева колонок TABLE (бэк резолвит).

const thBase =
  'whitespace-nowrap px-3 py-1.5 text-left text-[11px] font-semibold uppercase text-ui-06 align-bottom'

export const AccountingPostingsBlock = ({ node }: NodeProps) => {
  const { t } = useTranslation()

  // SCRUM-368: журнал проводок — первая волна PAGED (страницы из source.url);
  // без props.pagination — прежний INLINE-путь из state.
  const {
    paged,
    rows,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadTrigger,
    fetchNextPage,
    attachSentinel,
  } = usePagedTableRows<AccountingRow>(node)
  const labels = collectColumnLabels(node)
  const groups = collectGroupLabels(node)
  // SCRUM-362 B-3: сетка блока и биндинги внесеточных колонок — из ролей
  // колонок (props.role), не из захардкоженной раскладки/подсчёта по данным.
  const { rowDefs, semantic } = buildBlockModel(node)

  const label = (binding: string | undefined) =>
    binding ? (labels.get(binding) ?? '') : ''
  const headSpan = 1 + rowDefs.length

  // Виртуализация журнала (SCRUM-368): окно по БЛОКАМ проводок (tbody на N
  // строк). Распорки-tbody держат высоту скролла, ниже порога хука рендер
  // прежний (все блоки).
  const {
    isVirtualized,
    virtualItems,
    paddingTop,
    paddingBottom,
    setScrollerRef,
    measureBlock,
  } = useVirtualBlocks(rows.length, { mode: readVirtualization(node) })
  const renderedRows = virtualItems
    ? virtualItems.map((item) => ({ row: rows[item.index], idx: item.index }))
    : rows.map((row, idx) => ({ row, idx }))

  return (
    <div
      ref={setScrollerRef}
      className="min-h-0 flex-1 overflow-auto rounded-md border border-ui-04"
    >
      <table className="w-full border-collapse">
        <thead className="bg-ui-02">
          {/* Ряд 1 — группы ДЕБЕТ / КРЕДИТ. */}
          <tr className="border-b border-ui-04">
            <th rowSpan={headSpan} className={cn(thBase, 'text-center')}>
              {t('table.rowNumber')}
            </th>
            <th rowSpan={headSpan} className={thBase}>
              {label(semantic.period)}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {groups[0] ?? ''}
            </th>
            <th colSpan={4} className={cn(thBase, bl, 'text-center')}>
              {groups[1] ?? ''}
            </th>
            <th rowSpan={headSpan} className={cn(thBase, bl, 'text-right')}>
              {label(semantic.sum)}
            </th>
            <th rowSpan={headSpan} className={cn(thBase, bl)}>
              {label(semantic.content)}
            </th>
          </tr>
          {/* Ряды 2..N+1 — метки субконто/аналитики построчно, как в 1С. */}
          {rowDefs.map((rd, r) => (
            <tr
              key={r}
              className={
                r === rowDefs.length - 1 ? 'border-b border-ui-04' : undefined
              }
            >
              {r === 0 && (
                <th rowSpan={rowDefs.length} className={cn(thBase, bl)}>
                  {label(semantic.accountDt)}
                </th>
              )}
              <th className={thBase}>{label(rd.subDt)}</th>
              <th className={thBase}>{rd.a1Dt ? label(rd.a1Dt) : ''}</th>
              <th className={thBase}>{rd.a2Dt ? label(rd.a2Dt) : ''}</th>
              {r === 0 && (
                <th rowSpan={rowDefs.length} className={cn(thBase, bl)}>
                  {label(semantic.accountKt)}
                </th>
              )}
              <th className={thBase}>{label(rd.subKt)}</th>
              <th className={thBase}>{rd.a1Kt ? label(rd.a1Kt) : ''}</th>
              <th className={thBase}>{rd.a2Kt ? label(rd.a2Kt) : ''}</th>
            </tr>
          ))}
        </thead>
        {paddingTop > 0 && (
          <tbody aria-hidden="true">
            <tr>
              <td colSpan={12} style={{ height: paddingTop, padding: 0 }} />
            </tr>
          </tbody>
        )}
        {/* Каждая проводка — отдельный <tbody class="group"> для hover всего блока. */}
        {renderedRows.map(({ row, idx }) => (
          <tbody
            key={row.rowId}
            className="group"
            data-index={isVirtualized ? idx : undefined}
            ref={measureBlock}
          >
            {rowDefs.map((rd, r) => (
              <BlockRow
                key={r}
                row={row}
                rd={rd}
                semantic={semantic}
                first={r === 0}
                blockHeight={rowDefs.length}
                zebra={idx % 2 === 1}
                num={idx + 1}
              />
            ))}
          </tbody>
        ))}
        {paddingBottom > 0 && (
          <tbody aria-hidden="true">
            <tr>
              <td colSpan={12} style={{ height: paddingBottom, padding: 0 }} />
            </tr>
          </tbody>
        )}
      </table>
      {isLoading && rows.length === 0 && <ShimmerBlock className="m-3 h-24" />}
      {paged && (hasNextPage || isFetchingNextPage) && (
        <div className="flex flex-col items-center py-2">
          {loadTrigger === 'INFINITE_SCROLL' && hasNextPage && (
            <div ref={attachSentinel} aria-hidden="true" />
          )}
          {isFetchingNextPage && (
            <Typography variant="body2" className="text-ui-05">
              {t('sdui.loading')}
            </Typography>
          )}
          {loadTrigger !== 'INFINITE_SCROLL' &&
            hasNextPage &&
            !isFetchingNextPage && (
              <Button size="small" onClick={fetchNextPage}>
                {t('sdui.pagination.showMore')}
              </Button>
            )}
        </div>
      )}
    </div>
  )
}

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Typography } from '@mui/material'

import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'

import {
  DEFAULT_ANALYTICS_GROUPS,
  type AccountCardEntry,
  type AccountCardTotals,
  type AnalyticsGroups,
} from '../types/account-card'
import {
  analyticsList,
  computeCardLines,
} from '../lib/utils/compute-card-lines'

// Логические ширины колонок карточки счёта (ручной рендер → задаём через
// <colgroup>): даты/числа узкие, документ/операция средние, аналитика широкая.
// 0 Период · 1 Документ · 2 Операция · 3 Аналитика Дт · 4 Аналитика Кт ·
// 5 Корр.счёт · 6 Дебет · 7 Кредит · 8 Текущее сальдо.
const DEFAULT_COL_WIDTHS = [150, 190, 150, 230, 230, 110, 110, 110, 130]
const MIN_COL_WIDTH = 60

interface AccountCardTableProps {
  rows: AccountCardEntry[]
  /** Начальное сальдо счёта (signed) на начало периода — вычислено бэком. */
  opening: number
  /** Серверные агрегаты (обороты, конечное сальдо) — итоги при пагинации. */
  totals?: AccountCardTotals | null
  /** Какие аналитики показывать в колонках «Аналитика Дт/Кт» (чекбоксы). */
  groups?: AnalyticsGroups
  /** Всего движений за период (для подписи «загружено X из Y»). */
  totalCount?: number
  /** Есть ли ещё непогруженные страницы движений. */
  hasMore?: boolean
  /** Догрузить следующую страницу движений (lazy-load). */
  onLoadMore?: () => void
  isLoadingMore?: boolean
  /** Открыть документ-регистратор проводки (клик по колонке «Документ»). */
  onOpenDocument?: (row: AccountCardEntry) => void
  isLoading?: boolean
}

const td = 'border border-ui-04/60 px-3 py-1.5 align-top'
const th =
  'overflow-hidden whitespace-nowrap border border-ui-04/60 px-3 py-2 text-left text-xs font-semibold uppercase text-ui-06'

/** Денежная ячейка: разряды, пусто для 0, отрицательное — красным. */
const Money = ({
  v,
  bold,
  showZero,
}: {
  v: number
  bold?: boolean
  showZero?: boolean
}) => {
  const text = v === 0 && !showZero ? '' : formatWithSpaces(String(v))
  return (
    <Typography
      variant="body2"
      noWrap
      className={`text-right tabular-nums ${v < 0 ? 'text-support-01' : 'text-ui-06'} ${
        bold ? 'font-bold' : ''
      }`}
    >
      {text}
    </Typography>
  )
}

const AnalyticsCell = ({ items }: { items: string[] }) => (
  <div className="flex flex-col gap-0.5">
    {items.map((it, i) => (
      <Typography key={i} variant="body2" className="text-ui-06">
        {it}
      </Typography>
    ))}
  </div>
)

/**
 * Карточка счёта — хронология движений по счёту с накопительным сальдо и
 * аналитикой Дт/Кт (как в 1С). Строки: «Сальдо на начало» → проводки (Период,
 * Документ, Операция, Аналитика Дт/Кт, Корр.счёт, Дебет, Кредит, Текущее
 * сальдо) → «Обороты за период» → «Конечное сальдо». Вся учётная математика
 * считается на бэке; фронт рендерит готовые значения и листает (lazy-load).
 */
export const AccountCardTable = ({
  rows,
  opening,
  totals,
  groups = DEFAULT_ANALYTICS_GROUPS,
  totalCount,
  hasMore,
  onLoadMore,
  isLoadingMore,
  onOpenDocument,
  isLoading,
}: AccountCardTableProps) => {
  const { t } = useTranslation()

  // Ресайз колонок мышью (как в Excel). Рендер кастомный, ширины храним сами
  // и применяем через <colgroup>.
  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COL_WIDTHS)
  const [resizingCol, setResizingCol] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fitDoneRef = useRef(false)

  // При первом открытии вписываем колонки на всю ширину страницы, сохраняя
  // «логические» пропорции (аналитика широкая, числа узкие).
  useLayoutEffect(() => {
    if (fitDoneRef.current || isLoading || rows.length === 0) return
    const el = containerRef.current
    if (!el) return
    const avail = el.clientWidth - 2
    if (avail <= 0) return
    const sum = DEFAULT_COL_WIDTHS.reduce((a, b) => a + b, 0)
    const scale = avail / sum
    fitDoneRef.current = true
    setColWidths(
      DEFAULT_COL_WIDTHS.map((w) =>
        Math.max(MIN_COL_WIDTH, Math.round(w * scale))
      )
    )
  }, [isLoading, rows.length])

  const startResize = (index: number, e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[index]
    setResizingCol(index)
    // Запрет выделения текста на время перетаскивания.
    // eslint-disable-next-line react-hooks/immutability
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      setColWidths((prev) => {
        const next = [...prev]
        next[index] = Math.max(MIN_COL_WIDTH, startW + dx)
        return next
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      setResizingCol(null)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const resetColWidth = (index: number) => {
    setColWidths((prev) => {
      const next = [...prev]
      next[index] = DEFAULT_COL_WIDTHS[index]
      return next
    })
  }

  // Вся учётная математика — на бэке; здесь только переносим серверные поля
  // строк и итоги в модель таблицы (см. computeCardLines).
  const { lines, totalDt, totalKt, closing } = useMemo(
    () => computeCardLines(rows, totals),
    [rows, totals]
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  const totalWidth = colWidths.reduce((a, b) => a + b, 0)
  // Правые границы колонок (x в px) — для разделителей-ручек на всю высоту.
  const boundaries = colWidths.map((_, i) =>
    colWidths.slice(0, i + 1).reduce((a, b) => a + b, 0)
  )

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-md border border-ui-04/60"
    >
      {/* relative-обёртка: поверх таблицы — разделители-ручки на всю высоту. */}
      <div className="relative" style={{ width: totalWidth }}>
        {boundaries.map((x, i) => (
          <div
            key={i}
            onMouseDown={(e) => {
              startResize(i, e)
            }}
            onDoubleClick={() => {
              resetColWidth(i)
            }}
            title="Потяните, чтобы изменить ширину"
            style={{ left: x - 4 }}
            className="group absolute inset-y-0 z-20 flex w-2 cursor-col-resize touch-none select-none justify-center"
          >
            <div
              className={`h-full w-px ${
                resizingCol === i
                  ? 'bg-accent-02'
                  : 'bg-ui-04/40 group-hover:bg-accent-02'
              }`}
            />
          </div>
        ))}
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead className="bg-ui-02">
            <tr>
              <th className={th}>{t('accountCard.period')}</th>
              <th className={th}>{t('accountCard.document')}</th>
              <th className={th}>{t('accountCard.operation')}</th>
              <th className={th}>{t('accountCard.analyticsDt')}</th>
              <th className={th}>{t('accountCard.analyticsKt')}</th>
              <th className={th}>{t('accountCard.corrAccount')}</th>
              <th className={`${th} text-right`}>{t('accountCard.debit')}</th>
              <th className={`${th} text-right`}>{t('accountCard.credit')}</th>
              <th className={`${th} text-right`}>
                {t('accountCard.currentBalance')}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Сальдо на начало */}
            <tr className="bg-ui-02 font-medium">
              <td className={td} colSpan={8}>
                <Typography variant="body2" className="font-medium text-ui-06">
                  {t('accountCard.openingBalance')}
                </Typography>
              </td>
              <td className={`${td} text-right`}>
                <Money v={opening} bold showZero />
              </td>
            </tr>

            {/* Проводки */}
            {lines.map(
              ({ entry, debit, credit, debitQty, creditQty, balance }) => (
                <tr key={entry.id} className="transition-colors hover:bg-ui-07">
                  <td className={`${td} whitespace-nowrap`}>
                    <Typography variant="body2" noWrap className="text-ui-06">
                      {typeof entry.period === 'string'
                        ? formatDate(entry.period, 'dd.MM.yyyy HH:mm:ss')
                        : ''}
                    </Typography>
                  </td>
                  <td className={td}>
                    {entry.recorderDocumentName ? (
                      <button
                        type="button"
                        onClick={() => onOpenDocument?.(entry)}
                        className="text-left text-accent-02 hover:underline"
                      >
                        {entry.recorderDocumentName}
                      </button>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className={td}>
                    <Typography variant="body2" className="text-ui-06">
                      {entry.soderzhanie ?? ''}
                    </Typography>
                  </td>
                  <td className={td}>
                    <AnalyticsCell items={analyticsList(entry, 'Dt', groups)} />
                  </td>
                  <td className={td}>
                    <AnalyticsCell items={analyticsList(entry, 'Kt', groups)} />
                  </td>
                  <td className={td}>
                    <Typography variant="body2" noWrap className="text-ui-06">
                      {entry.korrAccountCode ?? ''}
                    </Typography>
                  </td>
                  <td className={`${td} text-right`}>
                    <Money v={debit} />
                    {debitQty !== 0 && (
                      <Typography
                        variant="caption"
                        className="block text-right tabular-nums text-ui-05"
                      >
                        {formatWithSpaces(String(debitQty))}
                      </Typography>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <Money v={credit} />
                    {creditQty !== 0 && (
                      <Typography
                        variant="caption"
                        className="block text-right tabular-nums text-ui-05"
                      >
                        {formatWithSpaces(String(creditQty))}
                      </Typography>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <Money v={balance} showZero />
                  </td>
                </tr>
              )
            )}

            {/* Обороты за период */}
            <tr className="bg-ui-02 font-medium">
              <td className={td} colSpan={6}>
                <Typography variant="body2" className="font-medium text-ui-06">
                  {t('accountCard.turnovers')}
                </Typography>
              </td>
              <td className={`${td} text-right`}>
                <Money v={totalDt} bold showZero />
              </td>
              <td className={`${td} text-right`}>
                <Money v={totalKt} bold showZero />
              </td>
              <td className={td} />
            </tr>

            {/* Конечное сальдо */}
            <tr className="bg-ui-02 font-bold">
              <td className={td} colSpan={8}>
                <Typography variant="body2" className="font-bold text-ui-06">
                  {t('accountCard.closingBalance')}
                </Typography>
              </td>
              <td className={`${td} text-right`}>
                <Money v={closing} bold showZero />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Постраничная (lazy) подгрузка: показываем сколько загружено и кнопку
            «Загрузить ещё», когда движений больше одной страницы (>1000). */}
        {(hasMore || (totalCount != null && totalCount > lines.length)) && (
          <div className="flex items-center justify-center gap-3 border-t border-ui-04/60 bg-ui-01 px-3 py-2">
            <Typography variant="caption" className="text-ui-05">
              {t('accountCard.loadedOf', {
                loaded: lines.length,
                total: totalCount ?? lines.length,
              })}
            </Typography>
            {hasMore && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => onLoadMore?.()}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? t('accountCard.loading')
                  : t('accountCard.loadMore')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

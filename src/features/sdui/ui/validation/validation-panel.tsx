import { useEffect, useLayoutEffect, useRef, type FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { cssVar, shadows } from '@/shared/design/tokens'
import {
  CORNER_BOTTOM_PX,
  CORNER_RIGHT_PX,
  clearCornerStack,
  publishCornerStack,
} from '@/shared/lib/utils/corner-stack'
import {
  isTargetNavigable,
  type ValidationMessage,
  type ValidationReport,
} from '@/entities/validation-report'

import { targetBinding } from '../../lib/validation/target-binding'

interface ValidationPanelProps {
  report: ValidationReport
  activeId: string | null
  /** Одиночный клик: ведёт к цели, окно тултипа не трогает (v4 §4.4). */
  onSelect: (message: ValidationMessage) => void
  /** Двойной клик: возвращает окно тултипа (v4 §4.4). */
  onActivate: (message: ValidationMessage) => void
  onClose: () => void
}

/**
 * Панель «Ошибки» (SCRUM-317, Figma «Ошибки» → «Поверх внизу»): правый нижний
 * угол, не гаснет по таймеру, копит все сообщения операции. Счётчик — число
 * сообщений В ПАНЕЛИ с severity != WARNING (v2 §2.5), не blockingCount.
 * Дубли не схлопываются (v1 §3.4).
 */
export const ValidationPanel: FC<ValidationPanelProps> = ({
  report,
  activeId,
  onSelect,
  onActivate,
  onClose,
}) => {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const errorCount = report.messages.filter(
    (m) => m.severity !== 'WARNING'
  ).length

  // SCRUM-317 v6 §4.2: замер на каждом рендере ДО отрисовки — отчёт и тост
  // приходят одним ответом, и тост обязан встать по свежей высоте с первого
  // кадра (ResizeObserver сработал бы уже после). Без массива зависимостей
  // намеренно: перечислить всё, от чего зависит высота панели (сообщения,
  // шрифт, переносы строк), надёжно нельзя, а замер offsetHeight дешёвый.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (el) publishCornerStack(el)
  })

  // ResizeObserver — для изменений размера без рендера панели (окно, 40vh).
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      publishCornerStack(el)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      // Обязательно: иначе тосты останутся висеть над пустым местом.
      clearCornerStack()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      data-testid="validation-panel"
      className="fixed z-[1250] flex w-[420px] max-w-[calc(100vw-48px)] flex-col rounded-lg bg-ui-01"
      // Позиция из модуля колонки угла: правый край общий с тостами.
      style={{
        right: CORNER_RIGHT_PX,
        bottom: CORNER_BOTTOM_PX,
        boxShadow: cssVar(shadows.popup),
      }}
    >
      <div className="flex items-center gap-2 border-b border-ui-03 px-4 py-3">
        <span className="text-support-01">⚠</span>
        <Typography variant="body2" className="flex-1 font-bold text-ui-06">
          {t('sdui.validation.panelTitle', { count: errorCount })}
        </Typography>
        <button
          type="button"
          aria-label={t('sdui.validation.close')}
          onClick={onClose}
          className="shrink-0 cursor-pointer"
        >
          <CrossIcon className="h-4 w-4" />
        </button>
      </div>
      <ul className="max-h-[40vh] overflow-y-auto py-1">
        {report.messages.map((m) => {
          const navigable = isTargetNavigable(m.target) || !!targetBinding(m)
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={!navigable}
                onClick={() => {
                  onSelect(m)
                }}
                onDoubleClick={() => {
                  onActivate(m)
                }}
                className={[
                  'flex w-full items-start gap-2 px-4 py-2 text-left',
                  navigable
                    ? 'cursor-pointer hover:bg-ui-02'
                    : 'cursor-default',
                  m.id === activeId ? 'bg-ui-04' : '',
                ].join(' ')}
              >
                <span
                  className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                    m.severity === 'WARNING' ? 'bg-support-03' : 'bg-support-01'
                  }`}
                />
                <Typography variant="body2" className="text-ui-06">
                  {m.message}
                </Typography>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

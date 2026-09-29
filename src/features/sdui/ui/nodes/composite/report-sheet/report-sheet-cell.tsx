import {
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import { figmaIcons } from '@/shared/ui/icons'

interface ReportSheetCellContentProps {
  /** Отформатированное значение из серверного payload. */
  text: string
  editable: boolean
  /** Подсказка ячейки: вид показателя, признак ручной правки. */
  hint: string
  /**
   * Коммит ввода. Результат не нужен: показ всегда возвращается к payload —
   * успешный ответ уже заменил его целиком, отказ оставил прежним.
   */
  onCommit: (raw: string) => boolean | Promise<boolean>
  onRasshifrovka: () => void
}

const valueSx = {
  fontSize: 13,
  textAlign: 'right' as const,
  fontVariantNumeric: 'tabular-nums',
}

const inputStyle: CSSProperties = {
  ...valueSx,
  width: '100%',
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  padding: '6px 8px 6px 32px',
}

/**
 * Содержимое ячейки сетки. Нередактируемая — кнопка расшифровки целиком
 * (клик, Enter, пробел). Редактируемая — поле ввода как в матрице Табеля:
 * коммит на Enter/blur, Esc откатывает; расшифровка — иконкой слева,
 * появляется при наведении или фокусе в ячейке.
 */
export const ReportSheetCellContent: FC<ReportSheetCellContentProps> = ({
  text,
  editable,
  hint,
  onCommit,
  onRasshifrovka,
}) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  if (!editable) {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      onRasshifrovka()
    }
    return (
      <Typography
        component="div"
        role="button"
        tabIndex={0}
        title={hint}
        onClick={onRasshifrovka}
        onKeyDown={onKeyDown}
        sx={{ ...valueSx, px: 1, py: 0.75, minHeight: 32, cursor: 'pointer' }}
      >
        {text}
      </Typography>
    )
  }

  const commit = (raw: string) => {
    setDraft(null)
    if (raw.trim() === text.trim()) return
    setPending(raw)
    void Promise.resolve(onCommit(raw)).finally(() => {
      setPending(null)
    })
  }

  return (
    <div className="group relative flex items-center">
      <span className="absolute left-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="tertiary"
          size="small"
          startIcon={figmaIcons['search-document']}
          aria-label={t('sdui.reportSheet.rasshifrovka')}
          title={t('sdui.reportSheet.rasshifrovka')}
          // Вне Tab-цепочки: Tab ходит по значениям, не по иконкам.
          tabIndex={-1}
          onClick={onRasshifrovka}
        />
      </span>
      <input
        style={{ ...inputStyle, opacity: pending == null ? 1 : 0.6 }}
        value={draft ?? pending ?? text}
        inputMode="decimal"
        title={hint}
        onFocus={(e) => {
          setDraft(e.target.value)
        }}
        onChange={(e) => {
          setDraft(e.target.value)
        }}
        onBlur={(e) => {
          // Esc: blur срабатывает до ре-рендера, e.target.value ещё содержит
          // отменённый ввод — коммитить его нельзя.
          if (cancelledRef.current) {
            cancelledRef.current = false
            setDraft(null)
            return
          }
          commit(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            cancelledRef.current = true
            e.currentTarget.blur()
            e.stopPropagation()
          }
        }}
      />
    </div>
  )
}

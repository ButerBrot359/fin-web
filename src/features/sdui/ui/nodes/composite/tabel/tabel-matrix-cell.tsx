import { useEffect, useRef, useState, type FC } from 'react'
import { Typography } from '@mui/material'

import { formatHours } from './tabel-matrix-logic'

interface TabelMatrixCellProps {
  /** Каноническое значение из серверного payload (decimal-строка) или пусто. */
  value: string | undefined
  readOnly: boolean
  weekend: boolean
  /**
   * Коммит нормализованного ввода. false (сразу или из промиса после ответа
   * сервера) — ввод отклонён, откатить буфер на канон.
   */
  onCommit: (raw: string) => boolean | Promise<boolean>
}

const baseStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 34,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  textAlign: 'center',
  fontSize: 13,
  padding: '4px 2px',
}

/**
 * Ячейка часов: локальный буфер, коммит на blur/Enter (не на keystroke —
 * каждый коммит уходит REPLACE_EMPLOYEE-мутацией). Esc откатывает ввод.
 */
export const TabelMatrixCell: FC<TabelMatrixCellProps> = ({
  value,
  readOnly,
  weekend,
  onCommit,
}) => {
  const canonical = formatHours(value)
  const [buffer, setBuffer] = useState(canonical)
  const focusedRef = useRef(false)
  const cancelledRef = useRef(false)

  // Синхронизация с каноном при внешнем обновлении payload — но не под курсором
  useEffect(() => {
    if (focusedRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация с внешним каноном (образец kalendari-template-table)
    setBuffer(canonical)
  }, [canonical])

  if (readOnly) {
    return (
      <Typography
        component="span"
        sx={{ fontSize: 13, opacity: value ? 1 : 0.4 }}
      >
        {canonical}
      </Typography>
    )
  }

  const commit = (raw: string) => {
    if (raw.trim() === canonical.trim()) return
    void Promise.resolve(onCommit(raw)).then((accepted) => {
      // Отказ сервера может прийти с тем же canonical (payload не изменился) —
      // тогда синхронизирующий эффект не сработает, откатываем буфер сами.
      // Ячейку, в которой пользователь уже снова печатает, не трогаем.
      if (!accepted && !focusedRef.current) setBuffer(canonical)
    })
  }

  return (
    <input
      style={{
        ...baseStyle,
        color: weekend ? 'var(--color-red-600, #d32f2f)' : undefined,
      }}
      value={buffer}
      inputMode="decimal"
      onChange={(e) => {
        setBuffer(e.target.value)
      }}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={(e) => {
        focusedRef.current = false
        // Esc: blur срабатывает до ре-рендера, e.target.value ещё содержит
        // отменённый ввод — коммитить его нельзя.
        if (cancelledRef.current) {
          cancelledRef.current = false
          setBuffer(canonical)
          return
        }
        commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Escape') {
          cancelledRef.current = true
          setBuffer(canonical)
          ;(e.target as HTMLInputElement).blur()
          e.stopPropagation()
        }
      }}
    />
  )
}

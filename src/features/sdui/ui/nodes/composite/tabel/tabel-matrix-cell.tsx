import { useEffect, useRef, useState, type FC } from 'react'

import { formatHours } from './tabel-matrix-logic'

interface TabelMatrixCellProps {
  /** Каноническое значение из серверного payload (decimal-строка) или пусто. */
  value: string | undefined
  readOnly: boolean
  weekend: boolean
  /** Коммит нормализованного ввода. false — ввод отклонён, откатить буфер. */
  onCommit: (raw: string) => boolean
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

  // Синхронизация с каноном при внешнем обновлении payload — но не под курсором
  useEffect(() => {
    if (focusedRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация с внешним каноном (образец kalendari-template-table)
    setBuffer(canonical)
  }, [canonical])

  if (readOnly) {
    return (
      <span style={{ fontSize: 13, opacity: value ? 1 : 0.4 }}>
        {canonical}
      </span>
    )
  }

  const commit = (raw: string) => {
    if (raw.trim() === canonical.trim()) return
    const accepted = onCommit(raw)
    if (!accepted) setBuffer(canonical)
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
        commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Escape') {
          setBuffer(canonical)
          ;(e.target as HTMLInputElement).blur()
          e.stopPropagation()
        }
      }}
    />
  )
}

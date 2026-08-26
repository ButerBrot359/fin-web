import { useEffect, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField } from '@mui/material'

import type { ViewNode } from '../../../types/view'
import { useSduiSession } from '../../../lib/sdui-session-context'
import {
  useTableSync,
  type TableRow as SyncRow,
} from '../../../lib/hooks/use-table-sync'

export const CYCLIC_CODE = 'PoTsiklamProizvolnoyDliny'
export const TEMPLATE_BINDING = 'ShablonZapolneniya'
export const MIN_CYCLE = 1
export const MAX_CYCLE = 366

export const findKalendariNodeByBinding = (
  root: ViewNode,
  binding: string
): ViewNode | null => {
  if (root.binding === binding) return root
  for (const child of root.children ?? []) {
    const found = findKalendariNodeByBinding(child, binding)
    if (found) return found
  }
  return null
}

// Общие позиции сохраняются, недостающие достраиваются unchecked с tmp-* id
// (spec v2 §5: resize replaces the local ordered template array).
export const resizeTemplateRows = (current: SyncRow[], n: number): SyncRow[] =>
  Array.from({ length: n }, (_, i) =>
    i < current.length
      ? current[i]
      : { rowId: `tmp-${crypto.randomUUID()}`, DenVklyuchenVGrafik: false }
  )

// Заглушка для безусловного вызова useTableSync, когда узла шаблона в дереве
// нет: без binding хук не регистрирует flush и ничего не шлёт.
const MISSING_TEMPLATE_NODE: ViewNode = {
  id: 'kalendari-template-missing',
  type: 'TABLE',
}
const NO_COLUMNS: never[] = []

interface KalendariCycleLengthFieldProps {
  disabled?: boolean
}

/**
 * Компактное поле длины цикла (spec v4): живёт в строке радио-опции
 * «По циклам…», а не над таблицей шаблона. Находит ShablonZapolneniya в
 * дереве сессии и владеет его resize; коммит — на blur/Enter, не на
 * keystroke (см. историю в kalendari-template-table: resize-на-onChange
 * стирал хвост при перепечатывании и слал EVENT на каждый символ).
 */
export const KalendariCycleLengthField: FC<KalendariCycleLengthFieldProps> = ({
  disabled = false,
}) => {
  const { t } = useTranslation()
  const { tree } = useSduiSession()
  const templateNode = tree
    ? findKalendariNodeByBinding(tree, TEMPLATE_BINDING)
    : null
  const sync = useTableSync(templateNode ?? MISSING_TEMPLATE_NODE, NO_COLUMNS)

  const [input, setInput] = useState<string>(String(sync.rows.length))
  const focusedRef = useRef(false)

  // Синхронизация буфера с каноном при внешних изменениях — но не под курсором
  useEffect(() => {
    if (focusedRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация с внешним каноном (см. use-table-sync.ts)
    setInput(String(sync.rows.length))
  }, [sync.rows.length])

  if (!templateNode) return null

  const commit = (raw: string) => {
    const parsed = raw.trim() === '' ? NaN : Math.floor(Number(raw))
    if (!Number.isFinite(parsed)) {
      setInput(String(sync.rows.length))
      return
    }
    const n = Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, parsed))
    if (n !== sync.rows.length) {
      sync.replaceRows(resizeTemplateRows(sync.rows, n))
    }
    setInput(String(n))
  }

  return (
    <TextField
      value={input}
      type="number"
      size="small"
      disabled={disabled}
      onChange={(e) => {
        setInput(e.target.value)
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
          commit((e.target as HTMLInputElement).value)
        }
      }}
      slotProps={{
        htmlInput: {
          min: MIN_CYCLE,
          max: MAX_CYCLE,
          'aria-label': t('sdui.kalendari.cycleLength'),
        },
      }}
      sx={{
        width: 82,
        '& input': { textAlign: 'right' },
      }}
    />
  )
}

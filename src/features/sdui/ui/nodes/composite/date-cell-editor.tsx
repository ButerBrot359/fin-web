import { useRef, type FC } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

import { DateTimeInput } from '@/shared/ui/inputs'

interface DateCellEditorProps {
  value: unknown
  /** DATE_FIELD → true (календарь), DATETIME_FIELD → false (календарь + время). */
  dateOnly: boolean
  sx: SxProps<Theme>
  onChange: (value: unknown) => void
  onCommit: () => void
}

/**
 * Дата в ячейке табличной части (SCRUM-279 D6).
 *
 * ЧТО БЫЛО СЛОМАНО. Ветка DATE_FIELD в `table-cell-editor.tsx` вызывала
 * `onCommit()` прямо в `onChange` пикера — то есть на КАЖДОМ сегменте даты. А
 * `onChange` у MUI-пикера стреляет на каждую введённую цифру (пока дата неполная —
 * со значением `null`). Каждый такой коммит уходил `sendEvent`'ом на сервер, канон
 * менялся, `useEffect([canonRows])` в `use-table-sync` перезаписывал строки,
 * колонки пересоздавались — ячейка перемонтировалась посреди набора и цифры
 * терялись. Аналитик видела «не вводится год»: «01012026» проходило, «010126»
 * давало 01.01.0002 (до года доезжала одна цифра из двух).
 *
 * Это в точности тот баг «ввод по 1 символу», который уже лечили для текстовых
 * колонок — см. комментарий в `useTableSync.updateCell`: канон синхронизируется
 * ТОЛЬКО на коммите (blur/Enter), правки до этого живут локально. TEXT_FIELD и
 * NUMBER_FIELD контракт соблюдают, дата была единственной колонкой, которая его
 * нарушала, поэтому баг и выжил только здесь.
 *
 * ЧТО СТАЛО. `onChange` — только локальное обновление, как у TEXT_FIELD. Коммит —
 * по завершении ввода: Enter, уход фокуса из ячейки, закрытие календаря.
 *
 * Две ловушки фокуса, из-за которых коммит нельзя вешать на `onBlur` наивно:
 *   1) клик по иконке календаря переводит фокус на кнопку ВНУТРИ ячейки — React
 *      `onBlur` (focusout) при этом всплывает, и наивный коммит сработал бы
 *      посреди набора. Отсекаем по `relatedTarget` внутри `currentTarget`.
 *   2) сам попап календаря живёт в портале, то есть вне `currentTarget`, и
 *      проверка (1) его не поймает. Поэтому пока календарь открыт, коммит по
 *      blur подавляется флагом и выполняется на `onClose`.
 */
export const DateCellEditor: FC<DateCellEditorProps> = ({
  value,
  dateOnly,
  sx,
  onChange,
  onCommit,
}) => {
  const strValue = typeof value === 'string' ? value : ''
  // Ref, а не state: флаг читают только обработчики, ре-рендер на него не нужен
  // (лишний ре-рендер ячейки — ровно то, от чего мы тут и уходим).
  const pickerOpenRef = useRef(false)

  return (
    <Box
      sx={sx}
      onBlur={(e) => {
        if (pickerOpenRef.current) return // ловушка 2: ждём onClose
        const next = e.relatedTarget
        if (next instanceof Node && e.currentTarget.contains(next)) return // ловушка 1
        onCommit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit()
      }}
    >
      <DateTimeInput
        value={strValue}
        dateOnly={dateOnly}
        onChange={onChange}
        onOpen={() => {
          pickerOpenRef.current = true
        }}
        onClose={() => {
          pickerOpenRef.current = false
          // Выбор даты мышью — законченное действие: коммитим сразу, не дожидаясь
          // ухода фокуса (иначе значение висело бы неотправленным).
          onCommit()
        }}
        size="small"
      />
    </Box>
  )
}

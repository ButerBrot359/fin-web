import type { FC } from 'react'
import { Box } from '@mui/material'

interface ColumnHeaderLabelProps {
  label: string
  /** Обязательная колонка — рисуем красную «*» справа от подписи (SCRUM-329). */
  required?: boolean
  /**
   * Выравнивание подписи внутри ячейки. Нужен явно, потому что подпись —
   * flex-контейнер: `align` на самой `TableCell` (`text-align`) на flex-потомка
   * не действует, и заголовок группы в read-only-таблице уехал бы влево.
   */
  align?: 'left' | 'center'
}

/**
 * Подпись колонки ТЧ — единственный рендерер заголовков SDUI-таблиц.
 *
 * Заголовок ОБРЕЗАЕТСЯ многоточием, а не переносится: ширину колонки задаёт бэк
 * (`props.width`), и подпись, которая в неё не влезла, раньше уходила на
 * несколько строк, вылезала за фиксированную высоту ячейки шапки и наезжала на
 * соседний заголовок — «заголовки собрались в кучу». В 1С поведение то же:
 * «Вид повременной оплаты тр…». Полный текст остаётся доступен в нативном
 * тултипе (`title`), поэтому обрезка ничего не скрывает.
 *
 * «*» вынесена из обрезаемого текста и не сжимается (`flexShrink: 0`): признак
 * обязательности не должен исчезать первым при узкой колонке.
 */
export const ColumnHeaderLabel: FC<ColumnHeaderLabelProps> = ({
  label,
  required = false,
  align = 'left',
}) => (
  <Box
    // minWidth: 0 — иначе flex/grid-контейнер не даёт потомку сжаться ниже
    // ширины текста и overflow:hidden ничего не обрезает.
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      minWidth: 0,
    }}
    title={label || undefined}
  >
    <Box
      component="span"
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
    {required && (
      <Box
        component="span"
        aria-hidden
        sx={{ color: 'error.main', ml: '2px', flexShrink: 0 }}
      >
        *
      </Box>
    )}
  </Box>
)

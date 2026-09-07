import type { ReactNode } from 'react'
import { Typography } from '@mui/material'

/**
 * Значение подвала табличной части: жирная строка либо пусто.
 *
 * Вынесено отдельно, потому что подвал рисуется из ДВУХ мест одной таблицы —
 * плоской колонки и стопки под-колонок вертикальной группы (её итоги приходят
 * списком `meta.footerKeys`), и оформление обязано совпадать.
 *
 * Пустая строка даёт `null`, а не пустой `<Typography>`: у стопки итогов
 * незаполненный слот должен занимать высоту, но не рисовать ничего.
 */
export const footerCell = (text: string): ReactNode =>
  text ? (
    <Typography variant="body2" fontWeight="bold">
      {text}
    </Typography>
  ) : null

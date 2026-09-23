import type { FC } from 'react'
import { Typography } from '@mui/material'

/** Атрибут, по которому группа находит подписи своей колонки (SCRUM-355 §8.3). */
export const FIELD_LABEL_ATTR = 'data-sdui-field-label'

// Подпись слева и СНАРУЖИ рамки поля (labelPlacement: 'left', SCRUM-355 §5).
// minWidth из CSS-переменной: в эталоне подписи занимают колонку общей ширины
// и поля начинаются с одного x — переменную выставляет группа-хозяйка
// (use-group-label-column), без неё подписи идут лесенкой.
export const FieldLabelLeft: FC<{ text: string }> = ({ text }) => (
  <Typography
    {...{ [FIELD_LABEL_ATTR]: '' }}
    variant="body2"
    whiteSpace="nowrap"
    sx={{ minWidth: 'var(--sdui-label-col, auto)', flex: '0 0 auto' }}
  >
    {text}
  </Typography>
)

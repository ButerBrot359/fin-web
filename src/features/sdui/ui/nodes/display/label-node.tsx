import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const LabelNode: FC<NodeProps> = ({ node }) => {
  const text = (node.props?.text as string | undefined) ?? ''
  const variant =
    (node.props?.variant as
      | 'default'
      | 'link'
      | 'heading'
      | 'module-title'
      | 'module-section'
      | 'comment'
      | undefined) ?? 'default'
  const dispatch = useSduiDispatch()
  const theme = useTheme()

  // SCRUM-181: серверные варианты страницы модуля — заголовок страницы
  // и заголовок подраздела визуально различимы (h5 против subtitle1).
  if (variant === 'module-title') {
    return (
      <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary' }}>
        {text}
      </Typography>
    )
  }

  if (variant === 'module-section') {
    return (
      <Typography
        variant="subtitle1"
        fontWeight={700}
        sx={{ color: 'primary.main' }}
      >
        {text}
      </Typography>
    )
  }

  if (variant === 'heading') {
    return (
      <Typography variant="subtitle1" fontWeight={700}>
        {text}
      </Typography>
    )
  }

  // SCRUM-278 v4: пояснительный текст — вторичный цвет, единый размер 14px,
  // читабельный межстрочный. Семантически отличен от лейблов и обычного текста.
  if (variant === 'comment') {
    return (
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.35 }}
      >
        {text}
      </Typography>
    )
  }

  if (variant === 'link') {
    const clickAction = node.actions?.find((a) => a.trigger === 'click')

    return (
      <Typography
        style={{
          color: theme.palette.primary.main,
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
        onClick={
          clickAction
            ? () =>
                void dispatch({
                  type: 'EVENT',
                  sourceNodeId: node.id,
                  trigger: clickAction.trigger,
                })
            : undefined
        }
      >
        {text}
      </Typography>
    )
  }

  return <Typography>{text}</Typography>
}

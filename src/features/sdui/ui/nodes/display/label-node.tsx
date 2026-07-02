import type { FC } from 'react'
import { Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const LabelNode: FC<NodeProps> = ({ node }) => {
  const text = (node.props?.text as string | undefined) ?? ''
  const variant = (node.props?.variant as 'default' | 'link' | 'heading' | undefined) ?? 'default'
  const dispatch = useSduiDispatch()
  const theme = useTheme()

  if (variant === 'heading') {
    return (
      <Typography variant="subtitle1" fontWeight={700}>
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

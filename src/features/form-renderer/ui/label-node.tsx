import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { LabelNode as LabelNodeType } from '@/entities/form-config'
import { cn } from '@/shared/lib/utils/cn'

interface LabelNodeProps {
  node: LabelNodeType
}

export const LabelNode = ({ node }: LabelNodeProps) => {
  const { t } = useTranslation()
  const text = node.textKey ? t(node.textKey) : (node.text ?? '')

  const variant = node.variant ?? 'default'

  return (
    <Typography
      className={cn(
        variant === 'link' && 'cursor-pointer text-accent-02 underline',
        variant === 'heading' && 'font-bold'
      )}
      variant={variant === 'heading' ? 'subtitle1' : 'body2'}
    >
      {text}
    </Typography>
  )
}

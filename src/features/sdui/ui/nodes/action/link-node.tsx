import type { FC, ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Link, Typography } from '@mui/material'

import { DisabledReasonTooltip } from '@/shared/ui/disabled-reason-tooltip'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const LinkNode: FC<NodeProps> = ({ node }) => {
  const text = node.props?.text as string | undefined
  const route = node.props?.route as string | undefined
  const external = node.props?.external as boolean | undefined
  const variant = node.props?.variant as string | undefined
  const disabled = node.props?.disabled === true
  const tooltip = node.props?.tooltip as string | undefined
  // SCRUM-308 v3 §3: серый поясняющий текст в 1–2 строки под ссылкой страницы
  // раздела. Ключа может не быть вовсе — тогда рисуется только ссылка.
  const description = node.props?.description as string | undefined

  const dispatch = useSduiDispatch()

  const withDescription = (link: ReactNode): ReactNode =>
    description ? (
      <div className="flex flex-col">
        {link}
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </div>
    ) : (
      link
    )

  // SCRUM-181 v3: disabled-пункт — известная команда 1С без опубликованного
  // приёмника. route у него намеренно отсутствует; геометрия строки та же, что
  // у активной ссылки, навигации нет ни мышью, ни клавиатурой.
  if (disabled) {
    const disabledLink = (
      <Link
        component="a"
        aria-disabled="true"
        tabIndex={0}
        underline="none"
        sx={{ color: 'text.disabled', cursor: 'default' }}
      >
        {text}
      </Link>
    )

    if (!tooltip) return withDescription(disabledLink)

    return withDescription(
      <DisabledReasonTooltip reason={tooltip}>
        {disabledLink}
      </DisabledReasonTooltip>
    )
  }

  const hasServerNavigate = node.actions?.some((a) => a.actionId === 'navigate')

  const handleClick = (e: React.MouseEvent) => {
    if (hasServerNavigate) {
      e.preventDefault()
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger: 'click' })
    }
  }

  if (external) {
    return withDescription(
      <Link
        href={route}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        {text}
      </Link>
    )
  }

  if (hasServerNavigate) {
    return withDescription(
      <Link
        component="a"
        href={route ?? '#'}
        onClick={handleClick}
        sx={{ cursor: 'pointer' }}
      >
        {text}
      </Link>
    )
  }

  // SCRUM-181: module-link — навигационная ссылка страницы модуля: без
  // подчёркивания, в цвете текста; акцент только на hover.
  return withDescription(
    <Link
      component={RouterLink}
      to={route ?? '/'}
      underline={variant === 'module-link' ? 'none' : 'always'}
      sx={
        variant === 'module-link'
          ? {
              color: 'text.primary',
              '&:hover': { color: 'primary.main', textDecoration: 'underline' },
            }
          : undefined
      }
    >
      {text}
    </Link>
  )
}

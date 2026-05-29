import type { FC } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Link } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const LinkNode: FC<NodeProps> = ({ node }) => {
  const text = node.props?.text as string | undefined
  const route = node.props?.route as string | undefined
  const external = node.props?.external as boolean | undefined

  const dispatch = useSduiDispatch()

  const hasServerNavigate = node.actions?.some((a) => a.actionId === 'navigate')

  const handleClick = (e: React.MouseEvent) => {
    if (hasServerNavigate) {
      e.preventDefault()
      void dispatch({ type: 'EVENT', sourceNodeId: node.id, trigger: 'click' })
    }
  }

  if (external) {
    return (
      <Link href={route} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {text}
      </Link>
    )
  }

  if (hasServerNavigate) {
    return (
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

  return (
    <Link component={RouterLink} to={route ?? '/'}>
      {text}
    </Link>
  )
}

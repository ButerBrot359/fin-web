import type { FC } from 'react'

import { ShimmerBlock } from '@/shared/ui/page-skeleton/page-skeleton'

import type { NodeProps } from '../../../types/view'
import { useHydrateNode } from '../../../lib/hooks/use-hydrate-node'
import { DeferredTableSkeleton } from './deferred-table-skeleton'
import { DeferredErrorState } from './deferred-error-state'

/**
 * Deferred-нода (SCRUM-384): данных по binding в OPEN не было — до прихода
 * HYDRATE-ответа рендерим скелетон по типу ноды (таблица — с реальными
 * колонками, прочее — блок-шиммер). Кикофф HYDRATE — на маунте, по одной
 * ноде на запрос; секции оживают независимо по мере ответов.
 */
export const DeferredNode: FC<NodeProps> = ({ node }) => {
  const error =
    typeof node.props?.error === 'string' && node.props.error !== ''
      ? node.props.error
      : null
  const retry = useHydrateNode(node.id, error !== null)
  const label = node.props?.label as string | undefined

  if (error !== null) {
    return <DeferredErrorState label={label} message={error} onRetry={retry} />
  }

  const hasColumns = node.children?.some(
    (c) => c.type === 'TABLE_COLUMN' || c.type === 'COLUMN_GROUP'
  )
  if (node.type === 'TABLE' && hasColumns) {
    return <DeferredTableSkeleton node={node} />
  }

  return <ShimmerBlock className="h-40 w-full" />
}

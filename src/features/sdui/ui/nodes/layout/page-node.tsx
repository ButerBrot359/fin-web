import { useEffect } from 'react'
import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { NodeRenderer } from '../../node-renderer'
import { ListOutputDialog } from '../composite/list-output-dialog'

// PAGE-узлы серверных диалогов приходят БЕЗ детей: состав лежит в пропах, а тело
// рисует клиент по props.kind. Первый такой вид — «Вывести список» (выбор колонок).
const KIND_LIST_OUTPUT_DIALOG = 'LIST_OUTPUT_DIALOG'

export const PageNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined
  const kind = node.props?.kind as string | undefined

  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])

  if (kind === KIND_LIST_OUTPUT_DIALOG) {
    return <ListOutputDialog node={node} />
  }

  return (
    <div className="flex flex-col gap-4">
      {node.children?.map((c) => (
        <NodeRenderer key={c.id} node={c} />
      ))}
    </div>
  )
}

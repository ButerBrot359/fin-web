import { useEffect } from 'react'
import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { cn } from '@/shared/lib/utils/cn'
import { NodeRenderer } from '../../node-renderer'
import { ListOutputDialog } from '../composite/list-output-dialog'

// PAGE-узлы серверных диалогов приходят БЕЗ детей: состав лежит в пропах, а тело
// рисует клиент по props.kind. Первый такой вид — «Вывести список» (выбор колонок).
const KIND_LIST_OUTPUT_DIALOG = 'LIST_OUTPUT_DIALOG'

export const PageNode: FC<NodeProps> = ({ node }) => {
  const title = node.props?.title as string | undefined
  const kind = node.props?.kind as string | undefined
  // Экран СПИСКА тянется на всю доступную высоту, и прокручивается САМА таблица —
  // тогда счётчик загруженных строк и «Выгрузить в Excel» стоят ПОД таблицей и видны
  // всегда, как на легаси-экранах. Без этого цепочка высоты рвалась здесь (страница
  // росла по содержимому), таблица собственной прокрутки не получала, и подвал уезжал
  // в самый конец списка. Карточкам это не нужно: их содержимое прокручивается страницей.
  const isListPage = (node.children ?? []).some(
    (child) => child.type === 'LIST'
  )
  // Карточка тянется на высоту, только если её раскладка об этом просит: props.flex
  // на контейнере тела — порт «РастягиватьПоВертикали» 1С («Начисление зарплаты»,
  // где таблица ТЧ должна доходить до подвала). Без пропа карточка остаётся ростом
  // по содержимому и прокручивается страницей, как описано выше.
  const isStretchedCard = (node.children ?? []).some(
    (child) => child.props?.flex !== undefined
  )

  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])

  if (kind === KIND_LIST_OUTPUT_DIALOG) {
    return <ListOutputDialog node={node} />
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        (isListPage || isStretchedCard) && 'min-h-0 flex-1'
      )}
    >
      {node.children?.map((c) => (
        <NodeRenderer key={c.id} node={c} />
      ))}
    </div>
  )
}

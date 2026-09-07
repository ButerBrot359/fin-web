import { useMemo, type FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import {
  SelectOperationDialog,
  type SelectOperationItem,
} from '@/shared/ui/select-operation-dialog'

interface VidOperatsiiOption extends SelectOperationItem {
  command: string
}

function readOptions(node: NodeProps['node']): VidOperatsiiOption[] {
  const raw = node.props?.vidOperatsiiOptions
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const { code, name, command } = item as {
      code?: unknown
      name?: unknown
      command?: unknown
    }
    if (typeof code !== 'string' || code === '') return []
    if (typeof command !== 'string' || command === '') return []
    return [{ code, name: typeof name === 'string' ? name : code, command }]
  })
}

/**
 * Диалог «Выберите операцию» перед созданием документа из формы списка.
 *
 * <p>Бэк отдаёт его PAGE-узлом БЕЗ детей: виды операции и их команды лежат в пропах
 * (`vidOperatsiiOptions`, `vidOperatsiiCancelCommand`), а тело рисует клиент — тот же приём,
 * что у {@link ListOutputDialog}.
 *
 * <p>Рисуется тем же `SelectOperationDialog`, что и на легаси-форме списка: дизайн окна выбора
 * операции один на оба маршрута, а не две похожие вёрстки. Собственное окно (MUI Dialog) —
 * поэтому узел несёт `props.selfChrome`, и `DialogHost` не оборачивает его в ещё одно.
 *
 * <p>Закрывает панель СЕРВЕР эффектом `closeDialog` — и на выбор, и на «Отмена»; клиент её сам
 * не прячет (как в диалоге «Вывести список»).
 */
export const VidOperatsiiChoiceDialog: FC<NodeProps> = ({ node }) => {
  const dispatch = useSduiDispatch()

  const options = useMemo(() => readOptions(node), [node])
  const cancelCommand = node.props?.vidOperatsiiCancelCommand as
    | string
    | undefined

  const handleSelect = (code: string) => {
    const chosen = options.find((o) => o.code === code)
    if (!chosen) return
    void dispatch({ type: 'COMMAND', command: chosen.command })
  }

  const handleClose = () => {
    if (!cancelCommand) return
    void dispatch({ type: 'COMMAND', command: cancelCommand })
  }

  return (
    <SelectOperationDialog
      open
      onClose={handleClose}
      onSelect={handleSelect}
      operations={options}
      isLoading={false}
    />
  )
}

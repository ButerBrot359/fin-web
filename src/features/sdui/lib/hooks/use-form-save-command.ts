import { useSduiDispatch } from '../dispatch'
import { useSduiSession } from '../sdui-session-context'
import { useTreeStore } from '../stores/tree-store'

/**
 * Команда записи текущей формы — для Ctrl+S из табличной части.
 *
 * Имя команды фронт не выдумывает и не разбирает: берём его из серверного
 * дескриптора `onDirtyClose` (ADR Action Behavior, тот же источник, из которого
 * записывает диалог «Есть несохранённые изменения»). Хардкод `command: 'save'`
 * контрактом запрещён — любая команда записи приходит данными.
 *
 * Поведение дескриптора переопределяется в одном месте: `closeAfter: false`.
 * Дескриптор описывает сценарий «записать И закрыть вкладку», а Ctrl+S в 1С
 * только записывает — форма остаётся открытой.
 *
 * В панели (форма строки, диалог) хоткей молчит: `onDirtyClose` принадлежит
 * root-экрану, и запись по Ctrl+S из диалога сохраняла бы не ту форму, в
 * которой пользователь находится.
 */
export function useFormSaveCommand(): () => void {
  const dispatch = useSduiDispatch()
  const session = useSduiSession()

  return () => {
    if (session.kind !== 'root') return
    const desc = useTreeStore.getState().onDirtyClose
    if (!desc?.command) return
    void dispatch(
      { type: 'COMMAND', command: desc.command },
      { ...desc.behavior, closeAfter: false }
    )
  }
}

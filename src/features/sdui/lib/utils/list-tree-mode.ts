import type { ViewNode, ViewNodeAction } from '../../types/view'
import type { useSduiDispatch } from '../dispatch'

/**
 * SCRUM-360 v6 §8: древовидный режим LIST-узла.
 *
 * Дискриминатор — props.displayMode === "TREE" (не наличие expanded/cellKind,
 * §8.4); отсутствие ключа = прежнее поведение. Транспорт тот же /search:
 * view=tree и expanded приходят уже собранными в source.params — фронт их не
 * трогает и не теряет (§8.7 п.1), params сидят в queryKey (§8.7 п.6), поэтому
 * патч source после list.toggleExpand перезапрашивает данные.
 */
export const isTreeDisplayMode = (node: ViewNode): boolean =>
  (node.props?.displayMode as string | undefined) === 'TREE'

/**
 * Колбэк раскрывателя дерева. value.expanded — ЖЕЛАЕМОЕ состояние, не
 * переключатель (команда идемпотентна, рассинхрон не страшен — §8.5).
 * Behavior — из действия expand (flush:false и т.д.), фронт его не сочиняет.
 * Нет действия с бэка → undefined, раскрыватель не рендерится (fail-closed).
 */
export const buildToggleExpand = (
  isTree: boolean,
  expandAction: ViewNodeAction | undefined,
  dispatch: ReturnType<typeof useSduiDispatch>,
  nodeId: string
): ((rowId: number, expanded: boolean) => void) | undefined =>
  isTree && expandAction?.command
    ? (rowId, expanded) => {
        void dispatch(
          {
            type: 'COMMAND',
            command: expandAction.command ?? '',
            value: { id: rowId, expanded },
            sourceNodeId: nodeId,
          },
          expandAction.behavior
        )
      }
    : undefined

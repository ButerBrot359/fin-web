import type { ViewNode } from '../../types/view'

/**
 * Форма целиком «только для чтения» (SCRUM-400 §5.3): сервер ставит
 * `props.readOnly: true` на корень дерева (OPEN) либо патчем `setProp readOnly`
 * на корень/panelId (EVENT, COMMAND, HYDRATE) — патчи уже применены к дереву,
 * поэтому читаем итоговое значение с корня. Молчание (ключа нет) = можно
 * редактировать; `readOnly: false` ОБЯЗАН снимать запирание («Отменить
 * проведение» у пользователя с правом).
 */
export const isFormReadOnly = (tree: ViewNode | null | undefined): boolean =>
  tree?.props?.readOnly === true

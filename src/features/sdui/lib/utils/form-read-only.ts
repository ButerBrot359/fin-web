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

/**
 * Узел заперт собственными пропами (SCRUM-400 §5.4): раскладочный `readonly`
 * (нижний регистр, 1С) ИЛИ `readOnly` прав (camelCase). Ключи НЕ
 * нормализуются — оба могут стоять на одном узле, решает логическое ИЛИ.
 * Единственная точка этого правила: новый виджет не должен копировать его сам.
 */
export const isReadOnlyProps = (
  props: Record<string, unknown> | undefined
): boolean => props?.readonly === true || props?.readOnly === true

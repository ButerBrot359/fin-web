import type { ActionBehavior, ViewAction } from '../../types/view'

/**
 * Подсвечивать ли пустые обязательные ячейки ТЧ по этому действию (SCRUM-329).
 * Только write-команды: save/post/postAndClose несут behavior.flushPendingTables:true.
 * reference-команды (showAll/create/open/copy) и rowActivate — false (или без
 * behavior). НЕ использовать shouldFlush (?? true) — он сработал бы на reference.
 */
export function shouldRevealTableErrors(
  action: ViewAction,
  behavior?: ActionBehavior | null
): boolean {
  return action.type === 'COMMAND' && behavior?.flushPendingTables === true
}

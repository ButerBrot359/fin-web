/**
 * Нормализация гэпа лейаут-нод (VSTACK/HSTACK/GRID) к ритму дизайн-системы.
 *
 * Контракт провода: gap — шаг 4px-шкалы (gap:4 → 16px). Figma задаёт жёсткий
 * вертикальный ритм форм 16/32 (аудит Ф3, design-audit/forms-panels.md §1.3),
 * поэтому:
 * - gap не пришёл → пол ритма 16px (раньше 0 — поля слипались);
 * - явный 0 уважаем (компоновки «встык»: таблица к строке-сводке);
 * - остальное клампится в [4, 32]px — конфиги с gap:16 (64px на «Графиках
 *   работы») это опечатка масштаба, а не намеренные дыры в пол-экрана.
 */
export const DEFAULT_STACK_GAP_PX = 16

export function resolveStackGap(gap: number | undefined): number {
  if (gap === undefined) return DEFAULT_STACK_GAP_PX
  if (gap <= 0) return 0
  // Потолок 24: конфиги с gap:8+ (32px и выше между полями — панели
  // организации/физлица) разъезжаются против ритма 16/24 Figma.
  return Math.min(Math.max(gap * 4, 4), 24)
}

/**
 * Паддинг контейнера: та же шкала ×4 и тот же кламп-потолок, дефолта нет
 * (без пропа контейнер не отступает — паддинги задают страница/панель).
 */
export function resolveStackPadding(padding: number | undefined): number {
  if (padding === undefined || padding <= 0) return 0
  return Math.min(Math.max(padding * 4, 4), 24)
}

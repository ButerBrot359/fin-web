import type { ViewPatch } from '../../types/view'

/**
 * Серверное поколение авторизации (SCRUM-400 §3.5): `authGeneration` приходит
 * в каждом ответе `/api/view`, монотонно не убывает ДЛЯ ОДНОГО пользователя и
 * растёт при публикации изменения его прав. Храним максимум: ответ с меньшим
 * значением пришёл поздно и не должен откатывать уже применённые
 * `enabled`/`readOnly`-патчи. Минимально достаточный вариант спеки: из такого
 * ответа не применяются ТОЛЬКО права-патчи (stripAccessPropPatches) — сам
 * результат команды (значения, эффекты, dirty) применяется: это мог быть
 * УСПЕШНЫЙ ответ записи, выбросить его целиком значит молча потерять исход.
 * `null` — «сигнал недоступен», не ноль.
 */

let maxGeneration: number | null = null

/** @returns false — ответ из прошлого поколения, применять нельзя. */
export function observeServerAuthGeneration(
  value: number | null | undefined
): boolean {
  if (value == null) return true
  if (maxGeneration === null || value >= maxGeneration) {
    maxGeneration = value
    return true
  }
  return false
}

/** Смена пользователя: между пользователями значения не сравниваются. */
export function resetServerAuthGeneration(): void {
  maxGeneration = null
}

/** Пропы, через которые приходят права (§5): их поздний патч лжёт. */
const ACCESS_PROP_KEYS = new Set([
  'enabled',
  'disabled',
  'readOnly',
  'readonly',
  'visible',
  'tooltip',
  'allowAdd',
  'allowDelete',
  'allowReorder',
  'allowCreate',
  'allowOpen',
  'allowCopy',
  'allowShowAll',
  'addDeniedReason',
  'tableCommands',
])

/**
 * Патчи позднего (по поколению) ответа без права-патчей: `setProp` ключей
 * доступности отбрасывается, всё остальное (значения, removeNode, ошибки)
 * применяется как обычно.
 */
export function stripAccessPropPatches(
  patches: ViewPatch[] | undefined
): ViewPatch[] {
  return (patches ?? []).filter(
    (p) =>
      !(
        p.op === 'setProp' &&
        typeof p.key === 'string' &&
        ACCESS_PROP_KEYS.has(p.key)
      )
  )
}

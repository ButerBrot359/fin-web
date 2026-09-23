// SCRUM-308 v1 §5: FIFO-очередь действий формы на formSessionId. Скалярная
// правка (EVENT по blur/чекбоксу) и следующая команда не должны идти вразнобой:
// сохранение не уходит раньше, чем сервер подтвердил правку. Два инварианта:
// - ход берётся ПОСЛЕ flush табличной части (flush сам диспатчит события —
//   взятый до него ход дал бы дедлок);
// - ход держится ДО ПРИМЕНЕНИЯ ПАТЧЕЙ, а не до HTTP-результата: следующий
//   запрос обязан читать подтверждённую revision.
// Очередь общая для всех хуков формы, включая диалоги в родительской сессии
// (у них тот же formSessionId); панели с собственной сессией — свой ключ.

const tails = new Map<string, Promise<void>>()

/**
 * Занять ход в очереди сессии. Возвращает release: его обязан вызвать
 * взявший — в finally, после применения патчей ответа (или ошибки).
 * Без сессии (formSessionId=null) очереди нет — ход свободный.
 */
export function acquireFormTurn(
  formSessionId: string | null
): Promise<() => void> {
  if (!formSessionId) return Promise.resolve(() => undefined)
  const prev = tails.get(formSessionId) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = prev.then(() => current)
  tails.set(formSessionId, tail)
  return prev.then(() => () => {
    release()
    // Никто не встал следом — подчищаем ключ, чтобы Map не рос по закрытым сессиям
    if (tails.get(formSessionId) === tail) tails.delete(formSessionId)
  })
}

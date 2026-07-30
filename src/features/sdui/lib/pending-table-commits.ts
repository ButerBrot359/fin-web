const registry = new Map<symbol, () => Promise<void>>()

// Предохранитель: flush не должен блокировать save бесконечно (SCRUM-282 #5).
//
// По таймауту РЕДЖЕКТИМ, а не резолвим (SCRUM-314 §6). Резолв означал «считаем
// правки отправленными» — то есть ровно ту тихую потерю данных, из-за которой
// заведена задача: save уходил по старому состоянию, пользователь видел, что
// введённое исчезло, и ни ошибки, ни объяснения не получал. Реджект ловит
// dispatch и показывает тост `sdui.tableFlushFailed`, а save не выполняется:
// видимый отказ лучше молчаливой пропажи введённого.
export const FLUSH_TIMEOUT_MS = 5000

function withTimeout(promise: Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('table flush timed out'))
    }, FLUSH_TIMEOUT_MS)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    )
  })
}

export function registerPendingFlush(flush: () => Promise<void>): symbol {
  const token = Symbol('pending-flush')
  registry.set(token, flush)
  return token
}

export function unregisterPendingFlush(token: symbol): void {
  registry.delete(token)
}

export async function flushAllPendingTableCommits(): Promise<void> {
  const flushes = [...registry.values()]
  await Promise.all(flushes.map((fn) => withTimeout(fn())))
}

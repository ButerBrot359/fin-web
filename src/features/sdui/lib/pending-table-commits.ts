const registry = new Map<symbol, () => Promise<void>>()

// Предохранитель: если сервер не пришлёт canon для таблицы, flush не должен
// блокировать save бесконечно (SCRUM-282 #5) — по таймауту считаем завершённым.
export const FLUSH_TIMEOUT_MS = 5000

function withTimeout(promise: Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, FLUSH_TIMEOUT_MS)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err instanceof Error ? err : new Error(String(err)))
      },
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

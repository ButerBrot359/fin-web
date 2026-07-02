const registry = new Map<symbol, () => Promise<void>>()

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
  await Promise.all(flushes.map((fn) => fn()))
}

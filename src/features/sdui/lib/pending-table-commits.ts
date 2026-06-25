const registry = new Map<string, () => Promise<void>>()

export function registerPendingFlush(
  binding: string,
  flush: () => Promise<void>,
): void {
  registry.set(binding, flush)
}

export function unregisterPendingFlush(binding: string): void {
  registry.delete(binding)
}

export async function flushAllPendingTableCommits(): Promise<void> {
  const flushes = [...registry.values()]
  await Promise.all(flushes.map((fn) => fn()))
}

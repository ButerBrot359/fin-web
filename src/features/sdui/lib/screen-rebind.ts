const requested = new Map<string, string>()
const adopted = new Set<string>()

export function requestScreenRebind(from: string, to: string): void {
  if (from === to) return
  requested.set(from, to)
}

export function takeScreenRebind(from: string, current: string): boolean {
  const to = requested.get(from)
  requested.delete(from)
  if (to === undefined || to !== current) return false
  adopted.add(to)
  return true
}

export function consumeAdoptedScreen(route: string): boolean {
  return adopted.delete(route)
}

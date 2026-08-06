// Реестр-близнец pending-table-commits (SCRUM-329): на write-команде dispatch
// зовёт revealAllTableErrors(), каждая смонтированная ТЧ показывает пустые
// обязательные ячейки. Отдельный модуль — тот же паттерн, что flush-before-save.
const registry = new Map<symbol, () => void>()

export function registerRevealErrors(reveal: () => void): symbol {
  const token = Symbol('reveal-errors')
  registry.set(token, reveal)
  return token
}

export function unregisterRevealErrors(token: symbol): void {
  registry.delete(token)
}

export function revealAllTableErrors(): void {
  for (const reveal of registry.values()) reveal()
}

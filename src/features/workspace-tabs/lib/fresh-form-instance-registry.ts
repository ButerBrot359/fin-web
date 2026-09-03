type FreshFormInstanceCallback = (path: string) => void

const intents = new Set<string>()
const callbacks = new Set<FreshFormInstanceCallback>()

/** Путь без query: интент ставится до перехода, а маршрут может дополниться параметрами. */
function pathOf(route: string): string {
  const i = route.indexOf('?')
  return i >= 0 ? route.slice(0, i) : route
}

/**
 * Пометить: следующий переход на этот маршрут начинает НОВЫЙ экземпляр формы.
 *
 * <p>Ставится перед «Создать», копией и вводом на основании. Требование владельца: форма
 * создания открывается ПУСТОЙ всегда, а возврат на свою вкладку (переключение вкладок, без
 * такого перехода) обязан вернуть введённое. Маршрут `/documents/<Type>/new` обслуживает оба
 * случая, поэтому различить их можно только по намерению перехода.
 *
 * <p>Владелец формы (SDUI) подписывается через {@link onFreshFormInstance} и снимает свой
 * снимок вкладки — иначе он восстановился бы раньше, чем сервер успел что-либо сказать.
 */
export function markFreshFormInstance(route: string): void {
  const path = pathOf(route)
  intents.add(path)
  callbacks.forEach((cb) => {
    cb(path)
  })
}

/** Забрать интент (одноразовый) — вызывается при сборке OPEN. */
export function consumeFreshFormInstance(route: string): boolean {
  const path = pathOf(route)
  const has = intents.has(path)
  intents.delete(path)
  return has
}

/** Подписка владельца формы: «этот маршрут начинает новый экземпляр — сбрось своё». */
export function onFreshFormInstance(cb: FreshFormInstanceCallback): () => void {
  callbacks.add(cb)
  return () => {
    callbacks.delete(cb)
  }
}

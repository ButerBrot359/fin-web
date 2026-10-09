// SCRUM-330 Работа 2: formSessionId живёт в sessionStorage — переживает F5,
// умирает вместе с вкладкой браузера. Причина: при перезагрузке beforeunload
// обычно не доставляется, CLOSE не уходит, и новый OPEN упирался бы в
// блокировку брошенной сессии. Ключ — по роуту карточки: в одной вкладке
// браузера каждая карточка резюмит только собственную сессию.
const KEY_PREFIX = 'sdui-form-session:'

function storageKey(route: string): string {
  return KEY_PREFIX + route
}

export function readFormSession(route: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(route))
  } catch {
    return null
  }
}

export function saveFormSession(route: string, formSessionId: string): void {
  try {
    sessionStorage.setItem(storageKey(route), formSessionId)
  } catch {
    // sessionStorage недоступен (privacy mode) — резюм просто не сработает
  }
}

export function clearFormSession(route: string): void {
  try {
    sessionStorage.removeItem(storageKey(route))
  } catch {
    // см. saveFormSession
  }
}

/** Выход/смена пользователя (SCRUM-400 §10): резюм чужих сессий недопустим. */
export function clearAllFormSessions(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(KEY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => {
      sessionStorage.removeItem(key)
    })
  } catch {
    // см. saveFormSession
  }
}

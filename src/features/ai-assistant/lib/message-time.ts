export interface AssistantMessageTime {
  dateTime: string
  time: string
  dayKey: string
  dayLabel: string
  title: string
}

/** ISO timestamps are displayed in the browser's local time zone. */
export function formatAssistantMessageTime(
  createdAt: string | null | undefined,
  language: string
): AssistantMessageTime | null {
  if (!createdAt?.trim()) return null
  const date = new Date(createdAt)
  if (!Number.isFinite(date.getTime())) return null
  const locale = /^(?:kz|kk)(?:-|$)/i.test(language) ? 'kk-KZ' : 'ru-RU'
  const dayKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return {
    dateTime: date.toISOString(),
    time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date),
    dayKey,
    dayLabel: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date),
    title: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).format(date),
  }
}

export function buildAssistantMessageTimeline<
  T extends { createdAt?: string | null },
>(messages: readonly T[], language: string) {
  let previousDay: string | null = null
  return messages.map((message) => {
    const timestamp = formatAssistantMessageTime(message.createdAt, language)
    const startsDay = timestamp != null && timestamp.dayKey !== previousDay
    if (timestamp) previousDay = timestamp.dayKey
    return { message, timestamp, startsDay }
  })
}

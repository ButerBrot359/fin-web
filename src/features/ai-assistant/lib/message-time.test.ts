import { describe, expect, it } from 'vitest'

import {
  buildAssistantMessageTimeline,
  formatAssistantMessageTime,
} from './message-time'

const localTime = (day: number, hour = 9, minute = 5) =>
  new Date(2026, 8, day, hour, minute, 7).toISOString()

describe('assistant message timestamps', () => {
  it('shows local HH:mm with a complete datetime title and machine-readable timestamp', () => {
    const createdAt = localTime(10)
    const formatted = formatAssistantMessageTime(createdAt, 'ru')
    expect(formatted?.time).toBe('09:05')
    expect(formatted?.dayKey).toBe('2026-09-10')
    expect(formatted?.dayLabel).toContain('сентября')
    expect(formatted?.title).toContain('2026')
    expect(formatted?.title).toContain('09:05:07')
    expect(formatted?.dateTime).toBe(createdAt)
  })

  it.each(['kz', 'kk', 'kk-KZ'])(
    'formats dates in Kazakh for %s',
    (language) => {
      const formatted = formatAssistantMessageTime(localTime(10), language)
      expect(formatted?.time).toBe('09:05')
      expect(formatted?.dayLabel).toContain('қыркүйек')
    }
  )

  it.each([null, undefined, '', '   ', 'not-a-date', '2026-99-99T25:00:00'])(
    'hides invalid legacy timestamp %s',
    (createdAt) => {
      expect(formatAssistantMessageTime(createdAt, 'ru')).toBeNull()
    }
  )

  it('adds one separator per local day across user, assistant and error messages', () => {
    const messages = [
      { createdAt: localTime(10, 23, 58), role: 'USER' },
      { createdAt: localTime(10, 23, 59), role: 'ASSISTANT', error: 'Failed' },
      { createdAt: localTime(11, 0, 1), role: 'ASSISTANT' },
    ]
    const timeline = buildAssistantMessageTimeline(messages, 'ru')
    expect(timeline.map((entry) => entry.startsDay)).toEqual([
      true,
      false,
      true,
    ])
    expect(timeline.map((entry) => entry.timestamp?.time)).toEqual([
      '23:58',
      '23:59',
      '00:01',
    ])
  })

  it('does not add a duplicate separator after an undated legacy message', () => {
    const timeline = buildAssistantMessageTimeline(
      [
        { createdAt: localTime(10) },
        { createdAt: '' },
        { createdAt: localTime(10, 11) },
      ],
      'ru'
    )
    expect(timeline.map((entry) => entry.startsDay)).toEqual([
      true,
      false,
      false,
    ])
  })

  it('moves the same-day separator to the earliest message when an older page is prepended', () => {
    const latest = [
      { createdAt: localTime(10, 12) },
      { createdAt: localTime(10, 13) },
    ]
    const timeline = buildAssistantMessageTimeline(
      [{ createdAt: localTime(10, 8) }, ...latest],
      'ru'
    )
    expect(timeline.map((entry) => entry.startsDay)).toEqual([
      true,
      false,
      false,
    ])
  })
})

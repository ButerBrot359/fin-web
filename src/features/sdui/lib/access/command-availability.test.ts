import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { isCommandUnavailable } from './command-availability'

const tree = (children: ViewNode[]): ViewNode => ({
  id: 'page',
  type: 'PAGE' as never,
  children,
})

const btn = (id: string, command: string, enabled: boolean): ViewNode => ({
  id,
  type: 'BUTTON' as never,
  props: { command, enabled },
})

describe('isCommandUnavailable (SCRUM-400 §5.5, Ctrl+S)', () => {
  it('все носители команды погашены → недоступна', () => {
    const t = tree([btn('b1', 'save', false), btn('m1', 'save', false)])
    expect(isCommandUnavailable(t, 'save')).toBe(true)
  })

  it('хотя бы один носитель жив → доступна (кнопка + зеркало в «Ещё»)', () => {
    const t = tree([btn('b1', 'save', true), btn('m1', 'save', false)])
    expect(isCommandUnavailable(t, 'save')).toBe(false)
  })

  it('носителей нет вовсе → не считаем недоступной (решает сервер)', () => {
    expect(isCommandUnavailable(tree([]), 'save')).toBe(false)
    expect(isCommandUnavailable(null, 'save')).toBe(false)
  })
})

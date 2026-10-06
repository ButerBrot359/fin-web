import { beforeEach, describe, expect, it } from 'vitest'

import {
  observeServerAuthGeneration,
  resetServerAuthGeneration,
} from './server-auth-generation'

describe('server-auth-generation (SCRUM-400 §3.5)', () => {
  beforeEach(resetServerAuthGeneration)

  it('растущие и равные значения принимаются, меньшие — поздний ответ', () => {
    expect(observeServerAuthGeneration(14)).toBe(true)
    expect(observeServerAuthGeneration(16)).toBe(true)
    expect(observeServerAuthGeneration(16)).toBe(true)
    expect(observeServerAuthGeneration(15)).toBe(false)
  })

  it('null — «сигнал недоступен», не ноль: применяем и максимум не трогаем', () => {
    expect(observeServerAuthGeneration(10)).toBe(true)
    expect(observeServerAuthGeneration(null)).toBe(true)
    expect(observeServerAuthGeneration(undefined)).toBe(true)
    expect(observeServerAuthGeneration(9)).toBe(false)
  })

  it('reset (смена пользователя) обнуляет сравнение', () => {
    expect(observeServerAuthGeneration(100)).toBe(true)
    resetServerAuthGeneration()
    expect(observeServerAuthGeneration(1)).toBe(true)
  })
})

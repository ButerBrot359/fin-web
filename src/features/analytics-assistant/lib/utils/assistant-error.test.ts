import { describe, expect, it } from 'vitest'

import { extractErrorText, isAiSettingsMissing } from './assistant-error'

describe('extractErrorText', () => {
  it('строку возвращает как есть, пустую — как null', () => {
    expect(extractErrorText('всё сломалось')).toBe('всё сломалось')
    expect(extractErrorText('')).toBeNull()
  })

  it('у Error берёт message', () => {
    expect(extractErrorText(new Error('boom'))).toBe('boom')
    expect(extractErrorText(new Error(''))).toBeNull()
  })

  it('из тела ответа берёт первый заполненный текстовый ключ по приоритету', () => {
    expect(
      extractErrorText({ message: 'из message', detail: 'из detail' })
    ).toBe('из message')
    expect(extractErrorText({ detail: 'из detail' })).toBe('из detail')
    expect(extractErrorText({ message: '   ', title: 'из title' })).toBe(
      'из title'
    )
  })

  it('нетекстовые и пустые тела дают null', () => {
    expect(extractErrorText(null)).toBeNull()
    expect(extractErrorText(undefined)).toBeNull()
    expect(extractErrorText(42)).toBeNull()
    expect(extractErrorText({ code: 500 })).toBeNull()
  })
})

describe('isAiSettingsMissing', () => {
  it('узнаёт ненастроенный доступ к ИИ в разных формулировках', () => {
    expect(isAiSettingsMissing('AI settings not found')).toBe(true)
    expect(isAiSettingsMissing('LLM is not configured')).toBe(true)
    expect(isAiSettingsMissing('Доступ к ИИ не настроен')).toBe(true)
    expect(isAiSettingsMissing('Missing API key')).toBe(true)
    expect(isAiSettingsMissing('АПИ ключ не указан')).toBe(true)
    expect(isAiSettingsMissing('Ключ не задан')).toBe(true)
    expect(isAiSettingsMissing('Провайдер не выбран')).toBe(true)
    expect(isAiSettingsMissing('Ассистент выключен администратором')).toBe(true)
    expect(isAiSettingsMissing('Assistant is disabled')).toBe(true)
  })

  it('обычные ошибки выполнения за настройку не принимает', () => {
    expect(isAiSettingsMissing('Синтаксическая ошибка в SQL')).toBe(false)
    expect(isAiSettingsMissing('Request timed out')).toBe(false)
    expect(isAiSettingsMissing(null)).toBe(false)
  })
})

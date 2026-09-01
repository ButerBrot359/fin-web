import { describe, expect, it } from 'vitest'

import { resolveSelectValue } from './resolve-select-value'

describe('resolveSelectValue: server presentation (SCRUM-70)', () => {
  it('до загрузки options значение показывает server presentation', () => {
    const resolved = resolveSelectValue(
      { id: 30488, presentation: '123', targetTypeCode: 'Polzovateli' },
      []
    )

    expect(resolved).toMatchObject({ id: 30488, label: '123' })
  })

  it('presentation предпочитается устаревшим displayName/name', () => {
    const resolved = resolveSelectValue(
      { id: 1, presentation: 'Серверное', displayName: 'Старое', name: 'x' },
      []
    )

    expect(resolved?.label).toBe('Серверное')
  })

  it('без presentation прежний порядок (displayName) сохраняется', () => {
    const resolved = resolveSelectValue({ id: 2, displayName: 'Старое' }, [])

    expect(resolved?.label).toBe('Старое')
  })
})

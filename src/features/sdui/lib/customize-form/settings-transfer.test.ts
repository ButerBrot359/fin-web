import { describe, expect, it } from 'vitest'

import { parseViewSettingsFile } from './settings-transfer'

describe('parseViewSettingsFile', () => {
  it('разбирает валидный файл настроек вида', () => {
    const raw = JSON.stringify({
      kind: 'webbuh.view-settings',
      screenKey: 'X.ФормаОбъекта',
      exportedAt: '2026-09-10T00:00:00Z',
      patch: [{ nodeId: 'field.org', props: { visible: false } }],
    })

    expect(parseViewSettingsFile(raw)).toEqual([
      { nodeId: 'field.org', props: { visible: false } },
    ])
  })

  it('не-JSON и чужой kind отклоняются с человеческим текстом', () => {
    expect(() => parseViewSettingsFile('{битый')).toThrow('не является JSON')
    expect(() =>
      parseViewSettingsFile(JSON.stringify({ kind: 'other', patch: [] }))
    ).toThrow('не файл настроек вида')
  })
})

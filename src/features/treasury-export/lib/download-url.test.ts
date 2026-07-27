import { describe, it, expect } from 'vitest'

import { treasuryExportDownloadUrl } from './download-url'

describe('treasuryExportDownloadUrl', () => {
  it('строит абсолютный GET-URL одиночного документа', () => {
    const url = treasuryExportDownloadUrl('ZayavkaNaRegistratsiyuGPSdelki', 27855630)
    expect(url).toMatch(
      /\/api\/document-entries\/ZayavkaNaRegistratsiyuGPSdelki\/27855630\/treasury-export$/
    )
  })
})

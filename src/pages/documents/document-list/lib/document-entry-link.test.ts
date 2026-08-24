import { describe, expect, it } from 'vitest'

import { documentEntryLink } from './document-entry-link'

describe('documentEntryLink', () => {
  it('builds the canonical document route instead of the current module URL', () => {
    expect(documentEntryLink('Tabel', 42, 'https://dev.qazyna.ai')).toBe(
      'https://dev.qazyna.ai/documents/Tabel/42'
    )
  })
})

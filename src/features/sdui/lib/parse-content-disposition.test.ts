import { describe, expect, it } from 'vitest'

import { parseContentDispositionFilename } from './parse-content-disposition'

describe('parseContentDispositionFilename', () => {
  it('RFC 5987 filename* приоритетнее plain filename', () => {
    expect(
      parseContentDispositionFilename(
        `attachment; filename="fallback.pdf"; filename*=UTF-8''%D0%A1%D1%87%D1%91%D1%82.pdf`,
      ),
    ).toBe('Счёт.pdf')
  })

  it('plain filename в кавычках', () => {
    expect(
      parseContentDispositionFilename('attachment; filename="report.pdf"'),
    ).toBe('report.pdf')
  })

  it('plain filename без кавычек', () => {
    expect(
      parseContentDispositionFilename('attachment; filename=report.pdf'),
    ).toBe('report.pdf')
  })

  it('кривой percent-encoding в filename* → фолбэк на plain filename', () => {
    expect(
      parseContentDispositionFilename(
        `attachment; filename="fallback.pdf"; filename*=UTF-8''%E0%A4%A`,
      ),
    ).toBe('fallback.pdf')
  })

  it('пустой/отсутствующий заголовок → пустая строка', () => {
    expect(parseContentDispositionFilename(undefined)).toBe('')
    expect(parseContentDispositionFilename('')).toBe('')
    expect(parseContentDispositionFilename('inline')).toBe('')
  })
})

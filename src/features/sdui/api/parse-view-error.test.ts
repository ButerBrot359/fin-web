import { describe, expect, it } from 'vitest'
import { parseViewError } from './parse-view-error'

describe('parseViewError', () => {
  it('SDUI 422: error=SCREEN_NOT_SDUI + kind', () => {
    expect(
      parseViewError({
        error: 'SCREEN_NOT_SDUI',
        kind: 'DOCUMENT_LIST',
        route: '/x',
      })
    ).toEqual({ code: 'SCREEN_NOT_SDUI', kind: 'DOCUMENT_LIST' })
  })

  it('SDUI 404: error=ROUTE_UNKNOWN', () => {
    expect(parseViewError({ error: 'ROUTE_UNKNOWN', route: '/foo' })).toEqual({
      code: 'ROUTE_UNKNOWN',
    })
  })

  it('ключ code игнорируется — бэк эмитит только error (SCRUM-362 B-8)', () => {
    expect(parseViewError({ code: 'NOT_FOUND', message: 'нет типа' })).toEqual({
      message: 'нет типа',
    })
    expect(
      parseViewError({ error: 'ROUTE_UNKNOWN', code: 'NOT_FOUND' })
    ).toEqual({
      code: 'ROUTE_UNKNOWN',
    })
  })

  it('пустое/неизвестное тело — пустой объект', () => {
    expect(parseViewError(null)).toEqual({})
    expect(parseViewError('boom')).toEqual({})
  })
})

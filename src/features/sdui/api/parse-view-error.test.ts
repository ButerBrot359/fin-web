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

  // SCRUM-366 (ADR-0042 §0.1): ключа `code` бэк не эмитит — ветка удалена,
  // тело только с `code` разбирается как безкодовое.
  it('ключ `code` игнорируется (мёртвый фолбэк снят)', () => {
    expect(parseViewError({ code: 'NOT_FOUND', message: 'нет типа' })).toEqual({
      message: 'нет типа',
    })
  })

  it('422 DOCUMENT_VALIDATION: errors[] разбирается, attributeCode=null сохраняется', () => {
    expect(
      parseViewError({
        error: 'DOCUMENT_VALIDATION',
        message: 'Ошибки заполнения документа: …',
        errors: [
          {
            attributeCode: 'IstochnikFinansirovaniya',
            errorCode: 'COST_ANALYTICS_ISTOCHNIKFINANSIROVANIYA_NOT_FILLED',
            message: 'Не заполнен реквизит шапки "Источник финансирования"',
            code: 'COST_ANALYTICS_ISTOCHNIKFINANSIROVANIYA_NOT_FILLED',
          },
          {
            attributeCode: null,
            errorCode: 'HAS_SUBORDINATE_DOCUMENTS',
            message: 'По документу есть подчинённые документы',
          },
        ],
      })
    ).toEqual({
      code: 'DOCUMENT_VALIDATION',
      message: 'Ошибки заполнения документа: …',
      errors: [
        {
          attributeCode: 'IstochnikFinansirovaniya',
          errorCode: 'COST_ANALYTICS_ISTOCHNIKFINANSIROVANIYA_NOT_FILLED',
          message: 'Не заполнен реквизит шапки "Источник финансирования"',
        },
        {
          attributeCode: null,
          errorCode: 'HAS_SUBORDINATE_DOCUMENTS',
          message: 'По документу есть подчинённые документы',
        },
      ],
    })
  })

  it('errors[] пустой — ключ остаётся пустым массивом; не массив — ключа нет', () => {
    expect(
      parseViewError({ error: 'DOCUMENT_VALIDATION', errors: [] })
    ).toEqual({ code: 'DOCUMENT_VALIDATION', errors: [] })
    expect(parseViewError({ error: 'COMMAND_FAILED' })).toEqual({
      code: 'COMMAND_FAILED',
    })
  })

  it('пустое/неизвестное тело — пустой объект', () => {
    expect(parseViewError(null)).toEqual({})
    expect(parseViewError('boom')).toEqual({})
  })
})

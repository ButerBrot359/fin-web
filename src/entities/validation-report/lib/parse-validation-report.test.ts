import { describe, expect, it } from 'vitest'

import { parseValidationReport } from './parse-validation-report'

describe('parseValidationReport', () => {
  it('разбирает отчёт двух каналов: сообщения, адреса, счётчик', () => {
    const report = parseValidationReport({
      operation: 'post',
      blockingCount: 2,
      messages: [
        {
          id: 'm1',
          severity: 'ERROR',
          source: 'REQUIRED_ATTRIBUTE',
          blocking: true,
          message: 'Не заполнено поле «Специфика» в строке 1 ТЧ «ТМЗ»',
          target: {
            kind: 'TABLE_CELL',
            tableCode: 'TMZ',
            rowIndex: 0,
            columnCode: 'Spetsifika',
          },
          attributeCode: 'TMZ',
        },
        {
          id: 'm2',
          severity: 'ERROR',
          source: 'OPERATION',
          blocking: true,
          message: 'Документ заблокирован',
          target: null,
          attributeCode: null,
        },
      ],
    })
    expect(report).not.toBeNull()
    expect(report?.operation).toBe('post')
    expect(report?.blockingCount).toBe(2)
    expect(report?.messages[0].target).toEqual({
      kind: 'TABLE_CELL',
      tableCode: 'TMZ',
      rowIndex: 0,
      columnCode: 'Spetsifika',
    })
    expect(report?.messages[1].target).toBeNull()
  })

  it('пустой отчёт легален — им гасится панель (v1 §2.5)', () => {
    const report = parseValidationReport({
      operation: 'save',
      blockingCount: 0,
      messages: [],
    })
    expect(report?.messages).toEqual([])
  })

  it('неполный TABLE_CELL деградирует до TABLE, а не падает', () => {
    const report = parseValidationReport({
      blockingCount: 0,
      messages: [
        {
          id: 'm1',
          severity: 'ERROR',
          message: 'текст',
          target: { kind: 'TABLE_CELL', tableCode: 'TMZ' },
        },
      ],
    })
    expect(report?.messages[0].target).toEqual({
      kind: 'TABLE',
      tableCode: 'TMZ',
    })
  })

  it('неизвестный kind и мусор → target null, сообщение остаётся текстом', () => {
    const report = parseValidationReport({
      blockingCount: 0,
      messages: [
        {
          id: 'm1',
          severity: 'ERROR',
          message: 'текст',
          target: { kind: 'EMPLOYEE', employeeRef: 7 },
        },
        { message: 'без адреса вовсе' },
        'мусор',
        null,
      ],
    })
    expect(report?.messages).toHaveLength(2)
    expect(report?.messages[0].target).toBeNull()
    expect(report?.messages[1].id).toBe('msg-1')
  })

  it('null (422 с пустым validation) и не-объект → null', () => {
    expect(parseValidationReport(null)).toBeNull()
    expect(parseValidationReport(undefined)).toBeNull()
    expect(parseValidationReport({ blockingCount: 1 })).toBeNull()
  })
})

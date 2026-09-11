import { describe, expect, it } from 'vitest'

import type {
  ValidationMessage,
  ValidationReport,
} from '@/entities/validation-report'

import { rowAddressedTableCodes, rowErrorIndexes } from './table-row-errors'

const message = (
  id: string,
  target: ValidationMessage['target']
): ValidationMessage => ({
  id,
  severity: 'ERROR',
  source: 'BUSINESS_RULE',
  blocking: true,
  message: 'дубль',
  target,
  attributeCode: 'TMZ',
})

const report = (...messages: ValidationMessage[]): ValidationReport => ({
  operation: 'post',
  blockingCount: messages.length,
  messages,
})

describe('rowErrorIndexes', () => {
  it('собирает номера строк своей ТЧ', () => {
    const r = report(
      message('a', {
        kind: 'TABLE_CELL',
        tableCode: 'TMZ',
        rowIndex: 2,
        columnCode: 'Nomenklatura',
      }),
      message('b', {
        kind: 'TABLE_CELL',
        tableCode: 'TMZ',
        rowIndex: 3,
        columnCode: 'Nomenklatura',
      })
    )

    expect([...rowErrorIndexes(r, 'TMZ')]).toEqual([2, 3])
  })

  it('строки чужой ТЧ не берутся', () => {
    const r = report(
      message('a', {
        kind: 'TABLE_CELL',
        tableCode: 'OsnovnyeSredstva',
        rowIndex: 0,
        columnCode: 'OsnovnoeSredstvo',
      })
    )

    expect(rowErrorIndexes(r, 'TMZ').size).toBe(0)
  })

  it('адрес до таблицы целиком строк не подсвечивает', () => {
    const r = report(message('a', { kind: 'TABLE', tableCode: 'TMZ' }))

    expect(rowErrorIndexes(r, 'TMZ').size).toBe(0)
  })

  it('без отчёта и без binding — пусто', () => {
    expect(rowErrorIndexes(undefined, 'TMZ').size).toBe(0)
    expect(
      rowErrorIndexes(
        report(
          message('a', {
            kind: 'TABLE_CELL',
            tableCode: 'TMZ',
            rowIndex: 1,
            columnCode: 'Nomenklatura',
          })
        ),
        null
      ).size
    ).toBe(0)
  })
})

describe('rowAddressedTableCodes', () => {
  it('коды ТЧ, у которых есть адрес строки', () => {
    const r = report(
      message('a', {
        kind: 'TABLE_CELL',
        tableCode: 'TMZ',
        rowIndex: 1,
        columnCode: 'Nomenklatura',
      }),
      message('b', { kind: 'TABLE', tableCode: 'Podpisi' })
    )

    expect([...rowAddressedTableCodes(r)]).toEqual(['TMZ'])
  })

  it('пустой отчёт — пустое множество', () => {
    expect(rowAddressedTableCodes(null).size).toBe(0)
  })
})

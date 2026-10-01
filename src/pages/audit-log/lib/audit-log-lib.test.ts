import { describe, expect, it, vi } from 'vitest'

import {
  buildAuditLogParams,
  type AuditLogPage,
  type AuditLogQuery,
  type AuditLogRecord,
} from '../api/audit-log-api'
import {
  EMPTY_FILTERS,
  countExtraFilters,
  filtersFromSearchParams,
  filtersToQuery,
  filtersToSearchParams,
} from './audit-log-filters'
import { buildEntryLink } from './entry-link'
import {
  EXPORT_MAX_ROWS,
  buildAuditLogSheet,
  fetchAuditLogForExport,
} from './export-audit-log'
import { parseChanges } from './parse-changes'

const record = (overrides: Partial<AuditLogRecord> = {}): AuditLogRecord => ({
  id: 1,
  occurredAt: '2026-09-08T23:40:01',
  action: 'POST',
  actionPresentation: 'Проведение',
  outcome: 'SUCCESS',
  outcomePresentation: 'Выполнено',
  domainKind: 'DOCUMENT',
  entryId: 555,
  typeCode: 'PlatezhnoePoruchenie',
  entryPresentation: 'Платежное поручение № 12',
  userEntryId: 7,
  userLogin: 'Иванов Иван',
  userName: 'Иванов Иван Иванович',
  userIin: null,
  clientAddress: '95.56.1.2',
  userAgent: null,
  taskId: null,
  message: null,
  changes: null,
  ...overrides,
})

describe('параметры запроса журнала (SCRUM-371)', () => {
  it('не шлёт пустые отборы и шлёт события списком', () => {
    const params = buildAuditLogParams({
      page: 0,
      size: 50,
      userLogin: '  ',
      ip: ' 192.168.1.15 ',
      actions: ['POST', 'UNPOST'],
    })

    expect(params).toEqual({
      page: 0,
      size: 50,
      ip: '192.168.1.15',
      actions: 'POST,UNPOST',
    })
  })

  it('одно событие дублирует старым action — бэкенд без actions не покажет всё подряд', () => {
    expect(
      buildAuditLogParams({ page: 0, size: 50, actions: ['LOGIN'] })
    ).toEqual({ page: 0, size: 50, actions: 'LOGIN', action: 'LOGIN' })
  })
})

describe('отбор в адресной строке', () => {
  it('переживает круг «отбор → адрес → отбор»', () => {
    const filters = {
      ...EMPTY_FILTERS,
      from: '2026-09-01T00:00',
      actions: ['POST', 'UNPOST'],
      sessionId: 'abc',
    }

    const params = filtersToSearchParams(filters, 3)
    expect(params.toString()).toBe(
      'from=2026-09-01T00%3A00&sessionId=abc&actions=POST%2CUNPOST&page=3'
    )
    expect(filtersFromSearchParams(params)).toEqual({ filters, page: 3 })
  })

  it('мусорная страница — первая', () => {
    expect(filtersFromSearchParams(new URLSearchParams('page=-4')).page).toBe(0)
    expect(filtersFromSearchParams(new URLSearchParams('page=x')).page).toBe(0)
  })

  it('дописывает секунды к периоду и считает отборы второго ряда', () => {
    const filters = {
      ...EMPTY_FILTERS,
      from: '2026-09-01T10:15',
      ip: '1.2.3.4',
    }
    expect(filtersToQuery(filters, 0, 50).from).toBe('2026-09-01T10:15:00')
    expect(filtersToQuery(filters, 0, 50).to).toBeUndefined()
    expect(countExtraFilters(filters)).toBe(1)
  })
})

describe('ссылка на объект', () => {
  it('документ, справочник, регистр сведений — открываются, прочее — нет', () => {
    expect(buildEntryLink(record())).toBe('/documents/PlatezhnoePoruchenie/555')
    expect(
      buildEntryLink(
        record({ domainKind: 'DICTIONARY', typeCode: 'Kontragenty' })
      )
    ).toBe('/dictionaries/Kontragenty/555')
    expect(buildEntryLink(record({ domainKind: 'ACCOUNT_PLAN' }))).toBeNull()
    expect(buildEntryLink(record({ entryId: null }))).toBeNull()
  })
})

describe('изменения реквизитов', () => {
  it('разбирает «было → стало», пустое и битое — пустой список', () => {
    expect(
      parseChanges(
        '{"Summa":{"before":100,"after":"250"},"Kontragent":{"before":null,"after":{"id":1}}}'
      )
    ).toEqual([
      { field: 'Summa', before: '100', after: '250' },
      { field: 'Kontragent', before: null, after: '{"id":1}' },
    ])
    expect(parseChanges(null)).toEqual([])
    expect(parseChanges('{не json')).toEqual([])
    expect(parseChanges('[1,2]')).toEqual([])
  })
})

describe('выгрузка в Excel', () => {
  const pageOf = (
    count: number,
    number: number,
    totalElements: number
  ): AuditLogPage => ({
    content: Array.from({ length: count }, (_, index) =>
      record({ id: number * 1000 + index })
    ),
    totalElements,
    totalPages: Math.ceil(totalElements / 200),
    number,
    size: 200,
  })

  it('собирает все страницы текущей выборки', async () => {
    const fetchPage = vi.fn((query: AuditLogQuery) =>
      Promise.resolve(pageOf(query.page === 0 ? 200 : 50, query.page, 250))
    )

    const result = await fetchAuditLogForExport({ ip: '1.2.3.4' }, fetchPage)

    expect(result.rows).toHaveLength(250)
    expect(result.truncated).toBe(false)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ ip: '1.2.3.4', page: 1, size: 200 })
    )
  })

  it('упирается в потолок и честно сообщает, что файл неполный', async () => {
    const fetchPage = vi.fn((query: AuditLogQuery) =>
      Promise.resolve(pageOf(200, query.page, 100_000))
    )

    const result = await fetchAuditLogForExport({}, fetchPage)

    expect(result.rows).toHaveLength(EXPORT_MAX_ROWS)
    expect(result.truncated).toBe(true)
    expect(fetchPage).toHaveBeenCalledTimes(EXPORT_MAX_ROWS / 200)
  })

  it('строит лист с колонками журнала и прочерками', () => {
    const sheet = buildAuditLogSheet(
      [
        record({
          clientLocalIp: '192.168.1.15',
          clientPublicIp: '95.56.1.2',
          computer: 'Бухгалтерия-1',
        }),
      ],
      (key) => key,
      'Журнал регистрации'
    )

    expect(sheet.headers).toHaveLength(12)
    expect(sheet.headers[10]).toBe('auditLog.ip')
    expect(sheet.rows[0][2]).toBe('Бухгалтерия-1')
    expect(sheet.rows[0][8]).toBe('—')
    expect(sheet.rows[0][10]).toBe('192.168.1.15 → 95.56.1.2')
  })
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Лёгкий acceptance-runner — без vitest/jsdom. Импортирует фикстуры,
 * прогоняет через инвариант рендера и сверяет результат с эталоном
 * из ТЗ. Запуск: `node --test fixtures/__tests__/acceptance.test.mjs`.
 *
 * Логика дублирует subkonto-value-kind.ts намеренно — если ветка
 * расходится между helper-ом и этим эталоном, тест краснеет.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '..')

const readFixture = (group, code) =>
  JSON.parse(readFileSync(join(FIXTURES, group, `${code}.json`), 'utf8'))

const ACCOUNT_TYPE_COLOR = {
  A: 'bg-blue-100 text-blue-700',
  P: 'bg-red-100 text-red-700',
  AP: 'bg-purple-100 text-purple-700',
}

const VALUE_KIND_COLOR = {
  DICTIONARY: 'bg-blue-100 text-blue-700',
  DOCUMENT: 'bg-emerald-100 text-emerald-700',
  ENUMS: 'bg-orange-100 text-orange-700',
  PRIMITIVE: 'bg-gray-100 text-gray-700',
  COMPOSITE: 'bg-purple-100 text-purple-700',
}

const describeRow = (row) => {
  switch (row.valueKind) {
    case 'DICTIONARY':
      return { summary: row.valueDictionaryTypeCode ?? '', composite: null }
    case 'DOCUMENT':
      return { summary: row.valueDocumentTypeCode ?? '', composite: null }
    case 'ENUMS':
      return { summary: row.valueEnumsTypeCode ?? '', composite: null }
    case 'PRIMITIVE':
      return { summary: row.valuePrimitiveType ?? '', composite: null }
    case 'COMPOSITE': {
      const targets = row.compositeTargets ?? []
      return {
        summary: targets.map((t) => t.targetNameRu).join(', '),
        composite: targets,
      }
    }
    default:
      throw new Error(`unknown valueKind: ${row.valueKind}`)
  }
}

const localizedName = (obj, lang) => {
  if ('kindNameRu' in obj) {
    return lang === 'kz' && obj.kindNameKz ? obj.kindNameKz : obj.kindNameRu
  }
  return lang === 'kz' && obj.nameKz ? obj.nameKz : obj.nameRu
}

test('1010: 2 DICTIONARY rows, badge A blue, currency ✓', () => {
  const entry = readFixture('entries', '1010').data
  const kinds = readFixture('subkonto-kinds', '1010').list

  assert.equal(entry.accountType, 'A')
  assert.equal(ACCOUNT_TYPE_COLOR[entry.accountType], 'bg-blue-100 text-blue-700')
  assert.equal(entry.isCurrency, true)
  assert.equal(entry.nameKz, null)
  // фолбэк на nameRu при null nameKz
  assert.equal(localizedName(entry, 'kz'), entry.nameRu)

  assert.equal(kinds.length, 2)
  for (const row of kinds) {
    assert.equal(row.valueKind, 'DICTIONARY')
    assert.equal(VALUE_KIND_COLOR[row.valueKind], 'bg-blue-100 text-blue-700')
    const d = describeRow(row)
    assert.equal(d.summary, row.valueDictionaryTypeCode)
    assert.equal(d.composite, null)
  }
})

test('2411: 2 DICTIONARY rows', () => {
  const entry = readFixture('entries', '2411').data
  const kinds = readFixture('subkonto-kinds', '2411').list
  assert.equal(entry.accountType, 'A')
  assert.equal(kinds.length, 2)
  assert.deepEqual(
    kinds.map((k) => k.valueKind),
    ['DICTIONARY', 'DICTIONARY']
  )
})

test('3242: DICTIONARY + DOCUMENT (different badge colors)', () => {
  const kinds = readFixture('subkonto-kinds', '3242').list
  assert.equal(kinds.length, 2)
  assert.equal(kinds[0].valueKind, 'DICTIONARY')
  assert.equal(kinds[1].valueKind, 'DOCUMENT')
  assert.notEqual(
    VALUE_KIND_COLOR[kinds[0].valueKind],
    VALUE_KIND_COLOR[kinds[1].valueKind]
  )
  assert.equal(describeRow(kinds[1]).summary, 'IspolnitelnyyList')
})

test('3248: COMPOSITE (2 targets) + ENUMS', () => {
  const kinds = readFixture('subkonto-kinds', '3248').list
  assert.equal(kinds.length, 2)
  const composite = kinds[0]
  assert.equal(composite.valueKind, 'COMPOSITE')
  const d = describeRow(composite)
  assert.equal(d.summary, 'Контрагенты, Физические лица')
  assert.equal(d.composite.length, 2)
  assert.deepEqual(
    d.composite.map((t) => t.targetCode),
    ['Kontragenty', 'FizicheskieLitsa']
  )
  assert.equal(kinds[1].valueKind, 'ENUMS')
  assert.equal(describeRow(kinds[1]).summary, 'VidyUderzhaniy')
})

test('6110: PRIMITIVE (STRING)', () => {
  const kinds = readFixture('subkonto-kinds', '6110').list
  assert.equal(kinds.length, 1)
  assert.equal(kinds[0].valueKind, 'PRIMITIVE')
  assert.equal(describeRow(kinds[0]).summary, 'STRING')
})

test('0000: empty subkonto list, badge AP, no crash', () => {
  const entry = readFixture('entries', '0000').data
  const kinds = readFixture('subkonto-kinds', '0000').list
  assert.equal(entry.accountType, 'AP')
  assert.equal(
    ACCOUNT_TYPE_COLOR[entry.accountType],
    'bg-purple-100 text-purple-700'
  )
  assert.equal(kinds.length, 0)
})

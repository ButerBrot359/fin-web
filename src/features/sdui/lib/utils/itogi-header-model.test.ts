import { describe, expect, it } from 'vitest'

import type { ItogiColumn } from './itogi-columns'
import { itogiTreeLayout } from './itogi-columns'
import { buildItogiHeader } from './itogi-header-model'

const col = (
  binding: string,
  label: string,
  numeric: boolean
): ItogiColumn => ({ id: binding, binding, label, numeric })

const columns = (nomer: string, levo: string, pravo: string) => [
  col('NomerPoPoryadku', nomer, true),
  col('Derevo', levo, false),
  col('DerevoPravo', pravo, false),
  col('Nachisleno', 'Начислено', true),
  col('KVyplate', 'К выплате', true),
]

const describeRows = (cols: ItogiColumn[]) =>
  buildItogiHeader(cols, itogiTreeLayout(cols)).map((cells) =>
    cells.map((c) => {
      const span = [
        c.colSpan > 1 ? `c${String(c.colSpan)}` : '',
        c.rowSpan > 1 ? `r${String(c.rowSpan)}` : '',
      ].join('')
      return span ? `${c.label}[${span}]` : c.label
    })
  )

describe('buildItogiHeader', () => {
  it('без флажка — четыре строки шапки, как в 1С', () => {
    expect(
      describeRows(
        columns(
          '№ п/п',
          'Физическое лицо\nПодразделение организации\nСотрудник\nВид начисления',
          '\nПериод регистрации\nДолжность\n'
        )
      )
    ).toEqual([
      ['№ п/п[r3]', 'Физическое лицо[c2]', 'Начислено[r4]', 'К выплате[r4]'],
      ['Подразделение организации', 'Период регистрации'],
      ['Сотрудник', 'Должность'],
      ['Вид начисления[c3]'],
    ])
  })

  it('с флажком — пять строк, номер «N», строка «ФКР | Специфика»', () => {
    expect(
      describeRows(
        columns(
          'N',
          'Физическое лицо\nПодразделение организации\nФКР\nСотрудник\nВид начисления',
          '\nПериод регистрации\nСпецифика\nДолжность\n'
        )
      )
    ).toEqual([
      ['N[r4]', 'Физическое лицо[c2]', 'Начислено[r5]', 'К выплате[r5]'],
      ['Подразделение организации', 'Период регистрации'],
      ['ФКР', 'Специфика'],
      ['Сотрудник', 'Должность'],
      ['Вид начисления[c3]'],
    ])
  })

  it('однострочные подписи дают обычную однострочную шапку', () => {
    expect(describeRows(columns('№', 'Физическое лицо', ''))).toEqual([
      ['№', 'Физическое лицо[c2]', 'Начислено', 'К выплате'],
    ])
  })

  it('ячейка шапки несёт свою колонку — для цвета «К выплате»', () => {
    const cols = columns('№ п/п', 'А\nБ', '\nВ')
    cols[4].textColor = '#0000FF'
    const header = buildItogiHeader(cols, itogiTreeLayout(cols))
    const kVyplate = header[0].find((c) => c.label === 'К выплате')
    expect(kVyplate?.column.textColor).toBe('#0000FF')
  })
})

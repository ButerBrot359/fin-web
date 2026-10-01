import { beforeEach, describe, expect, it } from 'vitest'

import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'
import {
  razobratTsv,
  sbrositKopiyu,
  stroitTsv,
  vzyatKopiyu,
  zapomnitKopiyu,
} from './table-clipboard'

const col = (
  binding: string,
  dataType: string,
  extra: Partial<TableColumnDef> = {}
): TableColumnDef => ({
  id: `col.${binding}`,
  label: binding,
  binding,
  cellWidget: 'TEXT_FIELD',
  dataType,
  props: {},
  ...extra,
})

const columns: TableColumnDef[] = [
  col('Nomenklatura', 'DICTIONARY'),
  col('Kolichestvo', 'DECIMAL'),
  col('Data', 'DATE'),
  col('Uchityvat', 'BOOLEAN'),
  col('Kommentariy', 'STRING'),
]

describe('table-clipboard', () => {
  beforeEach(() => {
    sbrositKopiyu()
  })

  describe('stroitTsv', () => {
    it('ссылка отдаётся представлением, дата и число — как есть, булево — Да/Нет', () => {
      const rows: TableRow[] = [
        {
          rowId: '1',
          Nomenklatura: { id: 42, presentation: 'Стол' },
          Kolichestvo: 2.5,
          Data: '2026-09-23',
          Uchityvat: true,
          Kommentariy: 'первый',
        },
      ]
      expect(stroitTsv(rows, columns)).toBe('Стол\t2.5\t2026-09-23\tДа\tпервый')
    })

    it('пустая ячейка — пустая позиция, строки разделены переводом строки', () => {
      const rows: TableRow[] = [
        { rowId: '1', Kommentariy: 'a' },
        { rowId: '2', Kommentariy: 'b' },
      ]
      expect(stroitTsv(rows, [col('Kommentariy', 'STRING')])).toBe('a\nb')
      expect(stroitTsv([{ rowId: '1' }], columns)).toBe('\t\t\t\t')
    })

    it('табы и переводы строк внутри значения схлопываются — иначе колонки разъедутся', () => {
      const rows: TableRow[] = [
        { rowId: '1', Kommentariy: 'две\tчасти\nстрок' },
      ]
      expect(stroitTsv(rows, [col('Kommentariy', 'STRING')])).toBe(
        'две части строк'
      )
    })
  })

  describe('razobratTsv', () => {
    it('простые типы разбираются, ссылочная колонка пропускается', () => {
      const values = razobratTsv('Стол\t2,5\t23.09.2026\tДа\tпервый', columns)
      expect(values).toEqual([
        {
          Kolichestvo: 2.5,
          Data: '2026-09-23',
          Uchityvat: true,
          Kommentariy: 'первый',
        },
      ])
    })

    it('число с пробелами-разделителями из Excel', () => {
      expect(razobratTsv('1 234,50', [col('Kolichestvo', 'DECIMAL')])).toEqual([
        { Kolichestvo: 1234.5 },
      ])
    })

    it('INTEGER округляется к целому, мусор в числе колонку не заполняет', () => {
      expect(razobratTsv('7,9', [col('Kol', 'INTEGER')])).toEqual([{ Kol: 7 }])
      expect(razobratTsv('нет числа', [col('Kol', 'INTEGER')])).toEqual([{}])
    })

    it('readonly-колонка занимает позицию, но значение из неё не применяется', () => {
      const cols = [
        col('Itogo', 'DECIMAL', { readonly: true }),
        col('Kommentariy', 'STRING'),
      ]
      expect(razobratTsv('100\tзаметка', cols)).toEqual([
        { Kommentariy: 'заметка' },
      ])
    })

    it('пустые строки текста игнорируются, лишние колонки отбрасываются', () => {
      expect(
        razobratTsv('a\tb\n\nc\n', [col('Kommentariy', 'STRING')])
      ).toEqual([{ Kommentariy: 'a' }, { Kommentariy: 'c' }])
    })
  })

  describe('свой буфер', () => {
    it('тот же текст — полные значения строк, включая ссылку и скрытую колонку', () => {
      const rows: TableRow[] = [
        {
          rowId: '1',
          Nomenklatura: { id: 42, presentation: 'Стол' },
          SkrytyyKlyuch: 'k-1',
          __rowReadonly: true,
        },
      ]
      const tekst = stroitTsv(rows, columns)
      zapomnitKopiyu(tekst, rows)
      expect(vzyatKopiyu(tekst)).toEqual([
        {
          Nomenklatura: { id: 42, presentation: 'Стол' },
          SkrytyyKlyuch: 'k-1',
        },
      ])
    })

    it('чужой текст в буфере — своих значений нет, вставка пойдёт разбором TSV', () => {
      zapomnitKopiyu('своё', [{ rowId: '1' }])
      expect(vzyatKopiyu('из Excel')).toBeNull()
    })
  })
})

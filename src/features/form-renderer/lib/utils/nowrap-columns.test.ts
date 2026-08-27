import { describe, it, expect } from 'vitest'
import type { DocumentAttribute } from '@/entities/document-type'
import { isNoWrapColumn } from './nowrap-columns'

const col = (code1C: string, code = ''): DocumentAttribute =>
  ({ code1C, code, dataType: 'STRING' }) as DocumentAttribute

describe('isNoWrapColumn', () => {
  it.each([
    'ИсточникФинансирования',
    'Сотрудник',
    'ПериодРегистрации',
    'ПодразделениеОрганизации',
    'Должность',
    'ВидНачисления',
    'ПлановыйОклад',
    'ГрафикРаботы',
    'НормаДней',
    'НормаЧасов',
    'ОтработаноДней',
    'ОтработаноЧасов',
    'НачалоПериода',
    'ОкончаниеПериода',
    'НормативнаяНагрузка',
    'НедельнаяНагрузка',
    'Размер',
  ])('%s исключён из переноса', (code1C) => {
    expect(isNoWrapColumn(col(code1C))).toBe(true)
  })

  // Тот же реквизит в ТЧ движений бухрегистра и разделений по шаблонам.
  it.each([
    'ИсточникФинансированияДт',
    'ИсточникФинансированияКт',
    'ИсточникФинансированияНаРазделение',
  ])('%s — тот же «Источник финансирования»', (code1C) => {
    expect(isNoWrapColumn(col(code1C))).toBe(true)
  })

  // Часть типов приезжает без code1C — тогда работает фолбэк по code.
  it('без 1С-имени опознаётся по транслитерированному code', () => {
    expect(isNoWrapColumn(col('', 'istochnikFinansirovaniya'))).toBe(true)
    expect(isNoWrapColumn(col('', 'OtrabotanoDney'))).toBe(true)
  })

  it('остальные колонки ТЧ переносят текст как прежде', () => {
    expect(isNoWrapColumn(col('КодПлатныхУслуг', 'kodPlatnykhUslug'))).toBe(
      false
    )
    expect(isNoWrapColumn(col('Сумма', 'summa'))).toBe(false)
  })
})

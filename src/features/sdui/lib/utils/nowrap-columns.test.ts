import { describe, it, expect } from 'vitest'
import { isNoWrapColumn } from './nowrap-columns'

describe('isNoWrapColumn — по биндингу', () => {
  it.each([
    'IstochnikFinansirovaniya',
    'Sotrudnik',
    'PeriodRegistratsii',
    'PodrazdelenieOrganizatsii',
    'Dolzhnost',
    'VidNachisleniya',
    'GrafikRaboty',
    'NormaDney',
    'NormaChasov',
    'OtrabotanoDney',
    'OtrabotanoChasov',
    'NachaloPerioda',
    'OkonchaniePerioda',
    'NormativnayaNagruzka',
    'NedelnayaNagruzka',
    'Razmer',
  ])('%s исключён из переноса', (binding) => {
    expect(isNoWrapColumn(binding)).toBe(true)
  })

  it('регистр биндинга не важен', () => {
    expect(isNoWrapColumn('istochnikFinansirovaniya')).toBe(true)
  })

  // Тот же реквизит в ТЧ движений бухрегистра и разделений по шаблонам.
  it.each([
    'IstochnikFinansirovaniyaDt',
    'IstochnikFinansirovaniyaKt',
    'IstochnikFinansirovaniyaNaRazdelenie',
  ])('%s — тот же «Источник финансирования»', (binding) => {
    expect(isNoWrapColumn(binding)).toBe(true)
  })

  it('остальные колонки ТЧ переносят текст как прежде', () => {
    expect(isNoWrapColumn('KodPlatnykhUslug')).toBe(false)
    expect(isNoWrapColumn('Spetsifika')).toBe(false)
    expect(isNoWrapColumn('Rezultat')).toBe(false)
  })
})

// Подпись — второй ключ: транслитерация биндинга у части реквизитов
// неочевидна, и промах в ней молча вернул бы колонке перенос.
describe('isNoWrapColumn — по подписи', () => {
  it.each([
    ['PlanOklad', 'Плановый оклад'],
    ['Whatever', 'Отработано (дн.)'],
    ['Whatever', 'Отработано (чс.)'],
    ['Whatever', 'Нормативная нагрузка'],
    ['Whatever', 'Период регистрации'],
    ['Whatever', 'Подразделение'],
  ])('биндинг %s + подпись «%s» → без переноса', (binding, label) => {
    expect(isNoWrapColumn(binding, label)).toBe(true)
  })

  it('регистр и «ё» подписи не важны', () => {
    expect(isNoWrapColumn('X', 'НОРМА ДНЕЙ')).toBe(true)
  })

  it('пустая подпись сама по себе ничего не исключает', () => {
    expect(isNoWrapColumn('X', '')).toBe(false)
  })

  it('чужая подпись под правило не попадает', () => {
    expect(isNoWrapColumn('X', 'Код платных услуг')).toBe(false)
  })
})

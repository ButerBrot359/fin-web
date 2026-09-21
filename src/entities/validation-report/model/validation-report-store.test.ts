import { beforeEach, describe, expect, it } from 'vitest'

import type {
  ValidationMessage,
  ValidationReport,
} from '../types/validation-report'
import { useValidationReportStore } from './validation-report-store'

const msg = (
  id: string,
  target: ValidationMessage['target'] = null
): ValidationMessage => ({
  id,
  severity: 'ERROR',
  source: null,
  blocking: true,
  message: `текст ${id}`,
  target,
  attributeCode: null,
})

const report = (messages: ValidationMessage[]): ValidationReport => ({
  operation: 'post',
  blockingCount: messages.length,
  messages,
})

const KEY = '/doc/1'

describe('validation-report-store', () => {
  beforeEach(() => {
    useValidationReportStore.setState({
      reports: {},
      activeIds: {},
      tooltipOpen: {},
      screenKey: null,
    })
  })

  it('setReport замещает список и активирует первое навигируемое сообщение', () => {
    const s = useValidationReportStore.getState()
    s.setReport(
      KEY,
      report([
        msg('m1'),
        msg('m2', { kind: 'FIELD', fieldCode: 'MOL' }),
        msg('m3', { kind: 'FIELD', fieldCode: 'FKR' }),
      ])
    )
    expect(
      useValidationReportStore.getState().reports[KEY].messages
    ).toHaveLength(3)
    expect(useValidationReportStore.getState().activeIds[KEY]).toBe('m2')
  })

  it('пустой отчёт гасит панель (v1 §3.3)', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, report([msg('m1')]))
    s.setReport(KEY, report([]))
    expect(useValidationReportStore.getState().reports[KEY]).toBeUndefined()
    expect(useValidationReportStore.getState().activeIds[KEY]).toBeUndefined()
  })

  it('stepActive обходит только навигируемые, по кругу (v1 §3.4 п.5)', () => {
    const s = useValidationReportStore.getState()
    s.setReport(
      KEY,
      report([
        msg('m1', { kind: 'FIELD', fieldCode: 'A' }),
        msg('m2'), // безадресное — пропускается
        msg('m3', { kind: 'DOCUMENT' }), // DOCUMENT — пропускается
        msg('m4', { kind: 'TABLE', tableCode: 'TMZ' }),
      ])
    )
    s.stepActive(KEY, 1)
    expect(useValidationReportStore.getState().activeIds[KEY]).toBe('m4')
    s.stepActive(KEY, 1)
    expect(useValidationReportStore.getState().activeIds[KEY]).toBe('m1')
    s.stepActive(KEY, -1)
    expect(useValidationReportStore.getState().activeIds[KEY]).toBe('m4')
  })

  it('отчёты разных экранов не смешиваются; clear гасит только свой', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, report([msg('m1')]))
    s.setReport('/doc/2', report([msg('x1')]))
    s.clear(KEY)
    const state = useValidationReportStore.getState()
    expect(state.reports[KEY]).toBeUndefined()
    expect(state.reports['/doc/2'].messages[0].id).toBe('x1')
  })
})

// SCRUM-317 v4 §4.4: «активное сообщение» и «тултип открыт» — разные состояния.
describe('tooltipOpen (v4 §4.4)', () => {
  beforeEach(() => {
    useValidationReportStore.setState({
      reports: {},
      activeIds: {},
      tooltipOpen: {},
      screenKey: null,
    })
  })

  it('новый отчёт открывает окно тултипа', () => {
    useValidationReportStore
      .getState()
      .setReport(KEY, report([msg('m1', { kind: 'FIELD', fieldCode: 'A' })]))
    expect(useValidationReportStore.getState().tooltipOpen[KEY]).toBe(true)
  })

  it('крестик тултипа закрывает окно, НЕ сбрасывая активное сообщение', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, report([msg('m1', { kind: 'FIELD', fieldCode: 'A' })]))
    s.closeTooltip(KEY)
    const state = useValidationReportStore.getState()
    expect(state.tooltipOpen[KEY]).toBe(false)
    expect(state.activeIds[KEY]).toBe('m1')
  })

  it('стрелки держат окно открытым; двойной клик (openTooltip) возвращает его', () => {
    const s = useValidationReportStore.getState()
    s.setReport(
      KEY,
      report([
        msg('m1', { kind: 'FIELD', fieldCode: 'A' }),
        msg('m2', { kind: 'FIELD', fieldCode: 'B' }),
      ])
    )
    s.closeTooltip(KEY)
    s.stepActive(KEY, 1)
    expect(useValidationReportStore.getState().tooltipOpen[KEY]).toBe(true)
    s.closeTooltip(KEY)
    s.openTooltip(KEY)
    expect(useValidationReportStore.getState().tooltipOpen[KEY]).toBe(true)
  })
})

// SCRUM-317 v4 §4.4 шаг 2: правка поля вычёркивает строки из панели.
describe('dismiss (v4 §4.4)', () => {
  beforeEach(() => {
    useValidationReportStore.setState({
      reports: {},
      activeIds: {},
      tooltipOpen: {},
      screenKey: null,
    })
  })

  const threeMessages = () =>
    report([
      msg('m1', { kind: 'FIELD', fieldCode: 'A' }),
      msg('m2', { kind: 'FIELD', fieldCode: 'B' }),
      msg('m3', { kind: 'TABLE', tableCode: 'TMZ' }),
    ])

  it('убирает только переданные id и пересчитывает blockingCount', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, threeMessages())
    s.dismiss(KEY, ['m2'])
    const rep = useValidationReportStore.getState().reports[KEY]
    expect(rep.messages.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(rep.blockingCount).toBe(2)
  })

  it('ушедшая активная строка сбрасывает activeIds и закрывает тултип', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, threeMessages())
    expect(useValidationReportStore.getState().activeIds[KEY]).toBe('m1')
    s.dismiss(KEY, ['m1'])
    const state = useValidationReportStore.getState()
    expect(state.activeIds[KEY]).toBeNull()
    expect(state.tooltipOpen[KEY]).toBe(false)
    // Неактивная строка ушла — активная и тултип не трогаются
    s.setActive(KEY, 'm2')
    s.openTooltip(KEY)
    s.dismiss(KEY, ['m3'])
    expect(useValidationReportStore.getState().activeIds[KEY]).toBe('m2')
    expect(useValidationReportStore.getState().tooltipOpen[KEY]).toBe(true)
  })

  it('последняя строка гасит панель целиком', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, report([msg('m1', { kind: 'FIELD', fieldCode: 'A' })]))
    s.dismiss(KEY, ['m1'])
    const state = useValidationReportStore.getState()
    expect(state.reports[KEY]).toBeUndefined()
    expect(state.activeIds[KEY]).toBeUndefined()
    expect(state.tooltipOpen[KEY]).toBeUndefined()
  })

  it('неизвестный id не меняет состояние', () => {
    const s = useValidationReportStore.getState()
    s.setReport(KEY, threeMessages())
    const before = useValidationReportStore.getState().reports[KEY]
    s.dismiss(KEY, ['nope'])
    expect(useValidationReportStore.getState().reports[KEY]).toBe(before)
  })
})

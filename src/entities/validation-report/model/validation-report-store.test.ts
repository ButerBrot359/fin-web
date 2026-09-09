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

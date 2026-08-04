import { describe, expect, it } from 'vitest'
import { resolvePageType } from './resolve-page-type'

// SCRUM-290 §4.5 отложен: регексы обслуживают легаси-вкладки, снятие ломает их.
// Гард фиксирует, что все текущие паттерны продолжают резолвиться.
describe('resolvePageType — регресс-гард (SCRUM-290, §4.5 отложен)', () => {
  it('SDUI/клиентские виды пока резолвятся регексом (до shell-миграции)', () => {
    expect(resolvePageType('/modules/kazna')).toBe('module')
    expect(resolvePageType('/modules/kazna/document/RKO/42')).toBe(
      'document-entry'
    )
    expect(resolvePageType('/modules/kazna/document/RKO/new')).toBe(
      'document-entry'
    )
    expect(resolvePageType('/modules/kazna/dictionary/Kontragent/7')).toBe(
      'dictionary-entry'
    )
  })

  it('легаси-виды резолвятся', () => {
    expect(resolvePageType('/modules/kazna/document/RKO')).toBe('document-list')
    expect(resolvePageType('/modules/kazna/dictionary/Kontragent')).toBe(
      'dictionary-list'
    )
    expect(resolvePageType('/modules/kazna/document/RKO/42/movements')).toBe(
      'document-movements'
    )
    expect(resolvePageType('/modules/kazna/informationregister/Reg')).toBe(
      'information-register-list'
    )
    expect(resolvePageType('/modules/kazna/account-card')).toBe('account-card')
  })

  it('несуществующий вид → null', () => {
    expect(resolvePageType('/foo/bar')).toBeNull()
  })
})

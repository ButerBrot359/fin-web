import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadModule = async () => {
  vi.resetModules()
  return import('./form-instance-id')
}

describe('form-instance-id: идентификатор экземпляра формы вкладки', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('переживает перезагрузку страницы в той же вкладке браузера', async () => {
    const before = await loadModule()
    const id = before.formInstanceIdFor('/documents/BolnichnyyList/42')

    const after = await loadModule()

    expect(after.formInstanceIdFor('/documents/BolnichnyyList/42')).toBe(id)
  })

  it('закрытая вкладка после перезагрузки получает новый идентификатор', async () => {
    const before = await loadModule()
    const id = before.formInstanceIdFor('/documents/BolnichnyyList/42')
    before.forgetFormInstanceId('/documents/BolnichnyyList/42')

    const after = await loadModule()

    expect(after.formInstanceIdFor('/documents/BolnichnyyList/42')).not.toBe(id)
  })

  it('принятый идентификатор сохраняется для пути', async () => {
    const mod = await loadModule()
    mod.adoptFormInstanceId('/documents/BolnichnyyList/42', 'tab-1')

    const after = await loadModule()

    expect(after.formInstanceIdFor('/documents/BolnichnyyList/42')).toBe(
      'tab-1'
    )
  })

  it('испорченное содержимое хранилища не ломает выдачу идентификатора', async () => {
    sessionStorage.setItem('workspace-form-instance-ids', '{')

    const mod = await loadModule()

    expect(mod.formInstanceIdFor('/documents/BolnichnyyList/42')).toBeTruthy()
  })
})

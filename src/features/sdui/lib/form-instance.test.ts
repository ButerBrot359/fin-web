import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkspaceTabsStore } from '@/features/workspace-tabs/lib/hooks/use-workspace-tabs-store'
import { forgetFormInstanceId } from '@/features/workspace-tabs/lib/utils/form-instance-id'
import { markFreshFormInstance } from '@/features/workspace-tabs/lib/fresh-form-instance-registry'
import { performTabClose } from '@/features/workspace-tabs'

import { useSduiCacheStore } from './stores/sdui-cache-store'
import { currentFormInstanceId } from './form-instance'
import { dropCachedScreensFor, isCreateRoute } from './fresh-form-instance'

const NEW_ROUTE = '/modules/ZarplatiIKadri/document/Otpusk/new'
const SAVED_ROUTE = '/modules/ZarplatiIKadri/document/Otpusk/42'

/**
 * Фронт-спека 03.09.2026 §5.1: идентификатор экземпляра формы разводит два запроса, которые на
 * проводе неразличимы, — «вернулась в свою форму» и «создаю новый документ». Оба требования
 * владельца (пустая форма создания ВСЕГДА; возврат на вкладку возвращает введённое) держатся
 * именно на нём.
 */
describe('formInstanceId экземпляра формы', () => {
  beforeEach(() => {
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    useSduiCacheStore.getState().clear()
    forgetFormInstanceId(NEW_ROUTE)
    forgetFormInstanceId(SAVED_ROUTE)
  })

  it('возврат на вкладку даёт прежний id — сервер восстановит её черновик', () => {
    const first = currentFormInstanceId(NEW_ROUTE)

    expect(currentFormInstanceId(NEW_ROUTE)).toBe(first)
  })

  it('«Создать» начинает НОВЫЙ экземпляр — форма создания пустая', () => {
    const before = currentFormInstanceId(NEW_ROUTE)

    markFreshFormInstance(NEW_ROUTE)

    expect(currentFormInstanceId(NEW_ROUTE)).not.toBe(before)
  })

  it('интент одноразовый: следующий OPEN того же маршрута id не меняет', () => {
    markFreshFormInstance(NEW_ROUTE)
    const fresh = currentFormInstanceId(NEW_ROUTE)

    expect(currentFormInstanceId(NEW_ROUTE)).toBe(fresh)
  })

  /** §5.1: «закрыли вкладку и открыли заново — новый id, иначе Создать подхватит черновик». */
  it('закрытие вкладки забывает id — следующая форма создания пустая', () => {
    const before = currentFormInstanceId(NEW_ROUTE)
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(NEW_ROUTE, '', 'document-entry')

    performTabClose(NEW_ROUTE, () => undefined)

    expect(currentFormInstanceId(NEW_ROUTE)).not.toBe(before)
  })

  /** §5.1: «id не меняется при переходе формы из состояния новый в записанный». */
  it('у записанного документа свой id, и он стабилен', () => {
    const saved = currentFormInstanceId(SAVED_ROUTE)

    expect(currentFormInstanceId(SAVED_ROUTE)).toBe(saved)
  })

  /** Снимок вкладки восстановился бы раньше ответа сервера — тогда пустая форма не пустая. */
  it('«Создать» снимает клиентский снимок этого маршрута', () => {
    useSduiCacheStore.getState().save(NEW_ROUTE + '?x=1', {
      root: { id: 'r', type: 'PAGE' } as never,
      formSessionId: 'fs',
      revision: 1,
      viewState: { field: 'старое значение' },
      dirty: true,
    })

    // В приложении это делает подписчик реестра (app/providers/workspace-tab-binding).
    dropCachedScreensFor(NEW_ROUTE)

    expect(useSduiCacheStore.getState().get(NEW_ROUTE + '?x=1')).toBeUndefined()
  })

  it('форма создания опознаётся по маршруту, карточка записанного документа — нет', () => {
    expect(isCreateRoute(NEW_ROUTE)).toBe(true)
    expect(isCreateRoute(NEW_ROUTE + '?basisId=7')).toBe(true)
    expect(isCreateRoute(SAVED_ROUTE)).toBe(false)
  })
})

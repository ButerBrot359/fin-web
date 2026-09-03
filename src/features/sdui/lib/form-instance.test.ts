import { beforeEach, describe, expect, it } from 'vitest'

import { useWorkspaceTabsStore } from '@/features/workspace-tabs/lib/hooks/use-workspace-tabs-store'
import { clearFormInstanceReservation } from '@/features/workspace-tabs/lib/utils/form-instance-id'

import { useSduiCacheStore } from './stores/sdui-cache-store'
import { currentFormInstanceId } from './form-instance'
import { markFreshFormInstance } from '@/features/workspace-tabs/lib/fresh-form-instance-registry'

import { dropCachedScreensFor, isCreateRoute } from './fresh-form-instance'

const NEW_ROUTE = '/modules/ZarplatiIKadri/document/Otpusk/new'

/**
 * Два требования владельца, которые различаются только НАМЕРЕНИЕМ перехода (маршрут у них
 * один и тот же): «Создать» открывает пустую форму ВСЕГДА, а возврат на свою вкладку
 * возвращает введённое. Различает их идентификатор экземпляра формы: сервер ведёт черновик
 * незаписанного документа только вместе с ним (DocumentFormDraftStore).
 */
describe('formInstanceId экземпляра формы', () => {
  beforeEach(() => {
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    useSduiCacheStore.getState().clear()
    clearFormInstanceReservation(NEW_ROUTE)
  })

  it('первый OPEN резервирует id, и созданная вкладка забирает ТОТ ЖЕ — черновик сессии не теряется', () => {
    const reserved = currentFormInstanceId(NEW_ROUTE)

    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(NEW_ROUTE, '', 'document-entry')

    const tab = useWorkspaceTabsStore.getState().tabs[0]
    expect(tab.formInstanceId).toBe(reserved)
  })

  it('возврат на вкладку даёт прежний id — сервер восстановит её черновик', () => {
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(NEW_ROUTE, '', 'document-entry')
    const first = currentFormInstanceId(NEW_ROUTE)

    expect(currentFormInstanceId(NEW_ROUTE)).toBe(first)
  })

  it('«Создать» на уже открытой вкладке начинает НОВЫЙ экземпляр — форма создания пустая', () => {
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(NEW_ROUTE, '', 'document-entry')
    const before = currentFormInstanceId(NEW_ROUTE)

    markFreshFormInstance(NEW_ROUTE)

    expect(currentFormInstanceId(NEW_ROUTE)).not.toBe(before)
  })

  it('интент одноразовый: следующий OPEN того же маршрута идентификатор не меняет', () => {
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(NEW_ROUTE, '', 'document-entry')
    markFreshFormInstance(NEW_ROUTE)

    const fresh = currentFormInstanceId(NEW_ROUTE)

    expect(currentFormInstanceId(NEW_ROUTE)).toBe(fresh)
  })

  /** Снимок вкладки восстановился бы раньше ответа сервера — тогда пустая форма не пустая. */
  it('«Создать» сразу снимает клиентский снимок этого маршрута', () => {
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

  it('запись документа вкладку не меняет: id тот же и после смены маршрута на записанный', () => {
    const tabId = useWorkspaceTabsStore
      .getState()
      .activateOrCreate(NEW_ROUTE, '', 'document-entry')
    const before = currentFormInstanceId(NEW_ROUTE)

    const savedRoute = '/modules/ZarplatiIKadri/document/Otpusk/42'
    useWorkspaceTabsStore.getState().updateTabPath(tabId!, savedRoute, '')

    expect(currentFormInstanceId(savedRoute)).toBe(before)
  })

  it('форма создания опознаётся по маршруту, карточка записанного документа — нет', () => {
    expect(isCreateRoute(NEW_ROUTE)).toBe(true)
    expect(isCreateRoute(NEW_ROUTE + '?basisId=7')).toBe(true)
    expect(isCreateRoute('/modules/ZarplatiIKadri/document/Otpusk/42')).toBe(
      false
    )
  })
})

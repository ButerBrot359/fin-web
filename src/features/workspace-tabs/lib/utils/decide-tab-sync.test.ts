import { describe, expect, it } from 'vitest'

import { decideTabSync, type TabSyncInput } from './decide-tab-sync'

function input(patch: Partial<TabSyncInput> = {}): TabSyncInput {
  return {
    hasPageType: true,
    isReplaceNavigation: false,
    forceNewTab: false,
    activeTabId: '/modules/gp/document/ZayavkaGP/27856789',
    prevPathname: '/modules/gp/document/ZayavkaGP/27856789',
    pathname: '/modules/gp/document/SchetKOplate/new',
    ...patch,
  }
}

describe('decideTabSync', () => {
  it('маршрут вне рабочих вкладок — ничего не делаем', () => {
    // Плоский /documents/:type/new: pageType ещё нет, впереди редирект
    expect(decideTabSync(input({ hasPageType: false }))).toBe('skip')
  })

  it('обычный переход создаёт вкладку', () => {
    expect(decideTabSync(input())).toBe('create')
  })

  it('редирект (REPLACE) переписывает путь активной вкладки', () => {
    expect(decideTabSync(input({ isReplaceNavigation: true }))).toBe('updateActive')
  })

  it('REPLACE без активной вкладки — создаём', () => {
    expect(
      decideTabSync(input({ isReplaceNavigation: true, activeTabId: null })),
    ).toBe('create')
  })

  it('REPLACE на тот же путь (менялся только search) активную вкладку не трогает', () => {
    expect(
      decideTabSync(
        input({
          isReplaceNavigation: true,
          prevPathname: '/modules/gp/document/SchetKOplate/new',
        }),
      ),
    ).toBe('create')
  })

  it('forceNewTab перебивает REPLACE — иначе редирект съел бы вкладку-источник', () => {
    expect(
      decideTabSync(input({ isReplaceNavigation: true, forceNewTab: true })),
    ).toBe('create')
  })

  it('forceNewTab на маршруте без pageType не срабатывает (флаг доживает до целевого)', () => {
    expect(
      decideTabSync(input({ hasPageType: false, forceNewTab: true })),
    ).toBe('skip')
  })
})

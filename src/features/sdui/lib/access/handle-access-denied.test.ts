import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { SduiSessionValue } from '../sdui-session-context'
import {
  handleAccessDenied,
  handleObjectNotFound,
  isTargetAddressedCommand,
} from './handle-access-denied'
import { useScreenAccessStore } from './screen-access-store'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('../../api/view-transport', () => ({
  viewTransport: { post: vi.fn().mockResolvedValue({}) },
}))

const session = (over: Partial<SduiSessionValue> = {}) =>
  ({
    kind: 'root',
    isDirty: false,
    resetDirty: vi.fn(),
    getSession: () => ({ formSessionId: null, revision: null }),
    getTree: () => null,
    tree: null,
    ...over,
  }) as unknown as SduiSessionValue

const ctx = (over: Record<string, unknown> = {}) => ({
  action: { type: 'COMMAND', command: 'save' } as never,
  behavior: null,
  isRetry: false,
  screenKey: '/documents/Tabel/1',
  session: session(),
  reopenFresh: vi.fn().mockResolvedValue(undefined),
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  useScreenAccessStore.getState().clearAll()
})

describe('handleAccessDenied — политика §5.9', () => {
  it('OPEN корневого экрана → экран «Нет доступа» с message сервера', () => {
    const c = ctx({ action: { type: 'OPEN' } })
    handleAccessDenied('Нет права на просмотр: Документ «Табель»', 'SESSION', c)
    expect(useScreenAccessStore.getState().byRoute[c.screenKey]).toEqual({
      kind: 'denied',
      message: 'Нет права на просмотр: Документ «Табель»',
    })
    expect(c.reopenFresh).not.toHaveBeenCalled()
  })

  it('scope TARGET → тост, форма цела, без переоткрытия', () => {
    const c = ctx({ action: { type: 'COMMAND', command: 'nav.open:X' } })
    handleAccessDenied('Нет права на создание: Справочник', 'TARGET', c)
    expect(showToast).toHaveBeenCalledWith(
      'warning',
      'Нет права на создание: Справочник'
    )
    expect(c.reopenFresh).not.toHaveBeenCalled()
    expect(useScreenAccessStore.getState().byRoute[c.screenKey]).toBeUndefined()
  })

  it('пишущая команда по resetsDirty → тост, dirty цел, без переоткрытия', () => {
    const c = ctx({ behavior: { resetsDirty: true } })
    handleAccessDenied('Нет права на изменение', 'SESSION', c)
    expect(showToast).toHaveBeenCalledWith('warning', 'Нет права на изменение')
    expect(c.reopenFresh).not.toHaveBeenCalled()
  })

  it('команда записи без behavior (Ctrl+S) тоже пишущая — правки не стираются', () => {
    const c = ctx({
      action: { type: 'COMMAND', command: 'save' },
      behavior: null,
    })
    handleAccessDenied(null, 'SESSION', c)
    expect(c.reopenFresh).not.toHaveBeenCalled()
  })

  it('прочий SESSION-отказ (потерян «Просмотр») → один свежий OPEN', () => {
    const c = ctx({ action: { type: 'HYDRATE' } })
    handleAccessDenied('Нет права на просмотр', 'SESSION', c)
    expect(c.reopenFresh).toHaveBeenCalledTimes(1)
  })

  it('повторный отказ (isRetry) → «Нет доступа», не зацикливаемся', () => {
    const c = ctx({ action: { type: 'HYDRATE' }, isRetry: true })
    handleAccessDenied('Нет права', 'SESSION', c)
    expect(c.reopenFresh).not.toHaveBeenCalled()
    expect(useScreenAccessStore.getState().byRoute[c.screenKey]).toMatchObject({
      kind: 'denied',
    })
  })

  it('панель не переоткрывается — только тост', () => {
    const c = ctx({
      action: { type: 'EVENT' },
      session: session({ kind: 'panel' }),
    })
    handleAccessDenied('Нет права', 'SESSION', c)
    expect(c.reopenFresh).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalled()
  })
})

describe('handleObjectNotFound — политика §9.5', () => {
  it('OPEN/EVENT по самой записи → экран «Объект не найден»', () => {
    const c = ctx({ action: { type: 'OPEN' } })
    handleObjectNotFound({
      action: c.action,
      session: c.session,
      screenKey: c.screenKey,
    })
    expect(useScreenAccessStore.getState().byRoute[c.screenKey]).toEqual({
      kind: 'not-found',
    })
  })

  it('грязная форма → предупреждение о потере правок и сброс dirty (§9.5)', () => {
    const s = session({ isDirty: true })
    handleObjectNotFound({
      action: { type: 'COMMAND', command: 'save' } as never,
      session: s,
      screenKey: '/documents/Tabel/1',
    })
    expect(showToast).toHaveBeenCalled()
    expect(s.resetDirty).toHaveBeenCalled()
    expect(
      useScreenAccessStore.getState().byRoute['/documents/Tabel/1']
    ).toEqual({ kind: 'not-found' })
  })

  it('команда с целью-другой записью (ref.select) → тост, форма цела', () => {
    const c = ctx({
      action: { type: 'COMMAND', command: 'ref.select:field.x' },
    })
    handleObjectNotFound({
      action: c.action,
      session: c.session,
      screenKey: c.screenKey,
    })
    expect(showToast).toHaveBeenCalled()
    expect(useScreenAccessStore.getState().byRoute[c.screenKey]).toBeUndefined()
  })
})

describe('isTargetAddressedCommand', () => {
  it.each([
    ['ref.select:field.organizatsiya', true],
    ['ref.open:field.organizatsiya', true],
    ['refcell.showAll:table.x', true],
    ['nav.rowOpen', true],
    ['table.podborSelect:Stroki', true],
    ['list.createBasedOn:Tabel:X', true],
    ['save', false],
    ['unpost', false],
    ['list.post:Tabel', false],
  ])('%s → %s', (command, expected) => {
    expect(
      isTargetAddressedCommand({ type: 'COMMAND', command } as never)
    ).toBe(expected)
  })
})

import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { DeferredNode } from './deferred-node'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}))

// Транзитивный импорт (format-cell-value → app/config/i18n) вызывает
// use/init на реальном модуле — мок обязан поддержать эту цепочку
vi.mock('i18next', () => {
  const i18n = {
    t: (k: string) => k,
    use: () => i18n,
    init: () => Promise.resolve(),
    on: () => undefined,
    off: () => undefined,
  }
  return { default: i18n }
})

const mockDispatch = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch:
    () =>
    (...args: unknown[]) =>
      mockDispatch(...(args as [])),
}))

const applyTreePatches = vi.fn()
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getSession: () => ({ formSessionId: 'fs-1', revision: 3 }),
    applyTreePatches,
  }),
}))

let nodeSeq = 0

function tableNode(extraProps: Record<string, unknown> = {}): ViewNode {
  // Уникальный id на каждый тест: in-flight реестр хука — модульный
  nodeSeq += 1
  return {
    id: `movements-${String(nodeSeq)}`,
    type: 'TABLE',
    binding: 'movements',
    props: { deferred: true, label: 'Движения', ...extraProps },
    children: [
      { id: 'c1', type: 'TABLE_COLUMN', props: { label: 'Счёт Дт' } },
      { id: 'c2', type: 'TABLE_COLUMN', props: { label: 'Счёт Кт' } },
    ],
  }
}

const flush = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('DeferredNode (SCRUM-384)', () => {
  beforeEach(() => {
    cleanup()
    mockDispatch.mockClear()
    mockDispatch.mockImplementation(() => Promise.resolve(true))
    applyTreePatches.mockClear()
  })

  it('рендерит скелетон таблицы с реальными колонками и шлёт HYDRATE на маунте', async () => {
    const node = tableNode()
    render(<DeferredNode node={node} />)

    expect(screen.getByText('Движения')).toBeTruthy()
    expect(screen.getByText('Счёт Дт')).toBeTruthy()
    expect(screen.getByText('Счёт Кт')).toBeTruthy()

    await flush()
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'HYDRATE',
      nodeIds: [node.id],
    })
  })

  it('не дублирует HYDRATE при ре-рендере', async () => {
    const node = tableNode()
    const { rerender } = render(<DeferredNode node={node} />)
    rerender(<DeferredNode node={node} />)
    await flush()
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it('нода без колонок рендерится блок-шиммером', async () => {
    const node: ViewNode = {
      id: `block-${String(++nodeSeq)}`,
      type: 'OBJECT_FIELD',
      binding: 'heavy',
      props: { deferred: true },
    }
    const { container } = render(<DeferredNode node={node} />)
    expect(container.querySelector('.animate-shimmer')).toBeTruthy()
    await flush()
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it('транспортный фейл помечает ноду error патчем setProp', async () => {
    mockDispatch.mockImplementation(() => Promise.resolve(false))
    const node = tableNode()
    render(<DeferredNode node={node} />)
    await flush()
    expect(applyTreePatches).toHaveBeenCalledWith([
      {
        op: 'setProp',
        nodeId: node.id,
        key: 'error',
        value: 'sdui.deferred.loadError',
      },
    ])
  })

  it('error-состояние: не шлёт HYDRATE автоматически, «Повторить» сбрасывает error и шлёт заново', async () => {
    const node = tableNode({ error: 'Срез не рассчитан' })
    render(<DeferredNode node={node} />)

    expect(screen.getByText('Срез не рассчитан')).toBeTruthy()
    await flush()
    expect(mockDispatch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('sdui.deferred.retry'))
    await flush()
    expect(applyTreePatches).toHaveBeenCalledWith([
      { op: 'setProp', nodeId: node.id, key: 'error', value: null },
    ])
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'HYDRATE',
      nodeIds: [node.id],
    })
  })
})

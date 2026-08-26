import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(true),
}))
const sessionState: Record<string, unknown> = {}
const treeState: { root: unknown } = { root: null }
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    tree: treeState.root,
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { KalendariCycleLengthField } from './kalendari-cycle-length-field'

const templateNode: ViewNode = {
  id: 'dict.field.ShablonZapolneniya',
  type: 'TABLE',
  binding: 'ShablonZapolneniya',
  props: {},
  children: [],
}
const tree = (): ViewNode => ({
  id: 'root',
  type: 'PAGE',
  children: [templateNode],
})

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    rowId: `r${String(i + 1)}`,
    DenVklyuchenVGrafik: i < 5,
  }))

afterEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const k of Object.keys(sessionState)) delete sessionState[k]
  treeState.root = null
})
beforeEach(() => mockDispatch.mockClear())

const setup = (n: number) => {
  sessionState.ShablonZapolneniya = rows(n)
  treeState.root = tree()
  render(<KalendariCycleLengthField />)
  return screen.getByLabelText<HTMLInputElement>('sdui.kalendari.cycleLength')
}

describe('KalendariCycleLengthField (spec v4: поле в строке радио-опции)', () => {
  it('показывает текущее количество строк шаблона', () => {
    const input = setup(7)
    expect(input.value).toBe('7')
  })

  it('увеличение → коммит на blur: общие позиции сохранены, новые unchecked tmp-*', () => {
    const input = setup(3)
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as {
      sourceNodeId: string
      value: { rowId: string; DenVklyuchenVGrafik: boolean }[]
    }
    expect(sent.sourceNodeId).toBe('dict.field.ShablonZapolneniya')
    expect(sent.value).toHaveLength(5)
    expect(sent.value.slice(0, 3).map((r) => r.rowId)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
    expect(sent.value[3].DenVklyuchenVGrafik).toBe(false)
    expect(sent.value[3].rowId.startsWith('tmp-')).toBe(true)
  })

  it('уменьшение → коммит по Enter: хвост отброшен', () => {
    const input = setup(6)
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as { value: unknown[] }
    expect(sent.value).toHaveLength(2)
  })

  it('промежуточный ввод без blur/Enter не резайзит и не шлёт EVENT', () => {
    const input = setup(3)
    fireEvent.change(input, { target: { value: '' } })
    expect(mockDispatch).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '5' } })
    expect(mockDispatch).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    const sent = mockDispatch.mock.calls[0][0] as { value: unknown[] }
    expect(sent.value).toHaveLength(5)
  })

  it('невалидный ввод откатывается к текущей длине без EVENT', () => {
    const input = setup(4)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(input.value).toBe('4')
  })

  it('значение зажимается в 1..366', () => {
    const input = setup(3)
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.blur(input)
    const sent = mockDispatch.mock.calls.at(-1)?.[0] as { value: unknown[] }
    expect(sent.value).toHaveLength(366)
  })

  it('без узла шаблона в дереве не рендерится', () => {
    treeState.root = { id: 'root', type: 'PAGE', children: [] }
    render(<KalendariCycleLengthField />)
    expect(screen.queryByLabelText('sdui.kalendari.cycleLength')).toBeNull()
  })
})

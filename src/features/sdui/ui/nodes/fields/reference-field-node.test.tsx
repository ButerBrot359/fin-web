import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { ViewNode } from '../../../types/view'
import type { SelectOption } from '@/shared/types/select-option'
import { ReferenceFieldNode } from './reference-field-node'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const openPickerMock = vi.fn<(req: Record<string, unknown>) => void>()
vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: (req: Record<string, unknown>) => {
    openPickerMock(req)
  },
}))

const fetchMock = vi.fn<(...args: unknown[]) => Promise<SelectOption[]>>()
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: (...args: unknown[]) => fetchMock(...args),
}))

/** Футер («Показать все»/«Создать») живёт в Paper автокомплита — существует
 *  только у открытого списка. */
const openDropdown = () => {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
}

// Явный afterEach нужен файлу целиком: vitest.config.ts не включает globals,
// и без него testing-library не подключает автоочистку между тестами —
// смонтированные компоненты накапливаются и combobox перестаёт быть уникальным.
afterEach(cleanup)

describe('ReferenceFieldNode — кэш опций', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([{ id: 1, code: '1', label: 'Запись 1' }])
    delete state.ref
  })

  it('после выбора значения кэш сбрасывается и следующий onOpen перезапрашивает опции', async () => {
    const node = {
      id: 'f1',
      type: 'REFERENCE_FIELD',
      binding: 'ref',
      props: { label: 'Ссылка', optionsSource: { url: '/api/test-options' } },
    } as unknown as ViewNode

    render(<ReferenceFieldNode node={node} />)
    const input = screen.getByRole('combobox')

    // Первое открытие: кэш пуст → запрос №1
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(await screen.findByText('Запись 1')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Выбор значения → applySelected (должен сбросить кэш опций)
    fireEvent.click(screen.getByText('Запись 1'))

    // Повторное открытие: кэш снова пуст → запрос №2
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})

// ── SCRUM-291 §18.3: props.allow* — единственный источник видимости ──
//
// Дефект: action-ветка сегодня игнорирует allow* (кнопка "+" показывается на
// поле со ссылкой на классификатор, где create запрещён политикой бэка).
// Формула (асимметричная, дефолты как на бэке):
//   showAll ⟺ showAllAction && allowShowAll !== false   (открыто по умолчанию)
//   create  ⟺ createAction  && allowCreate === true      (закрыто по умолчанию)
//   open    ⟺ openAction    && allowOpen === true         (закрыто по умолчанию)
//   copy    ⟺ copyAction    && allowCopy === true          (закрыто по умолчанию)
describe('ReferenceFieldNode — SCRUM-291 §18.3 allow* гейтинг', () => {
  // i18n в юнит-тестах не инициализирован — t() возвращает ключ, поэтому
  // матчим и ключ, и переведённую подпись.
  const showAllName = /showAll|Показать все/i
  const addName = /dictSidebar\.add|Добавить/i
  const openName = /openReference|Открыть запись/i
  const copyName = /copyReference|Скопировать запись/i

  const baseProps = {
    label: 'Ссылка',
    domain: 'DICTIONARY',
    targetTypeCode: 'Organizatsii',
    optionsSource: { url: '/api/test-options' },
  }

  const makeNode = (
    props: Record<string, unknown>,
    actions: { trigger: string; actionId: string; command?: string }[] = []
  ): ViewNode =>
    ({
      id: 'f1',
      type: 'REFERENCE_FIELD',
      binding: 'ref',
      props: { ...baseProps, ...props },
      actions,
    }) as unknown as ViewNode

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([])
    openPickerMock.mockReset()
    mockDispatch.mockClear()
    delete state.ref
  })

  // ── создать ──
  it('createAction есть, allowCreate !== true → «Создать» не показывается (дефект)', () => {
    render(
      <ReferenceFieldNode
        node={makeNode({ allowCreate: false }, [
          { trigger: 'create', actionId: 'command', command: 'ref.create:f1' },
        ])}
      />
    )
    openDropdown()
    expect(screen.queryByRole('button', { name: addName })).toBeNull()
  })

  it('createAction есть, allowCreate undefined → «Создать» не показывается (закрыто по умолчанию)', () => {
    render(
      <ReferenceFieldNode
        node={makeNode({}, [
          { trigger: 'create', actionId: 'command', command: 'ref.create:f1' },
        ])}
      />
    )
    openDropdown()
    expect(screen.queryByRole('button', { name: addName })).toBeNull()
  })

  it('createAction + allowCreate === true → клик диспатчит команду создания', () => {
    render(
      <ReferenceFieldNode
        node={makeNode({ allowCreate: true }, [
          { trigger: 'create', actionId: 'command', command: 'ref.create:f1' },
        ])}
      />
    )
    openDropdown()
    fireEvent.mouseDown(screen.getByRole('button', { name: addName }))
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'ref.create:f1',
      sourceNodeId: 'f1',
    })
    expect(openPickerMock).not.toHaveBeenCalled()
  })

  // ── показать все ──
  it('showAllAction + allowShowAll === false → «Показать все» не показывается', () => {
    render(
      <ReferenceFieldNode
        node={makeNode({ allowShowAll: false }, [
          {
            trigger: 'showAll',
            actionId: 'command',
            command: 'ref.showAll:f1',
          },
        ])}
      />
    )
    openDropdown()
    expect(screen.queryByRole('button', { name: showAllName })).toBeNull()
  })

  it('showAllAction + allowShowAll undefined → «Показать все» показывается (открыто по умолчанию)', () => {
    render(
      <ReferenceFieldNode
        node={makeNode({}, [
          {
            trigger: 'showAll',
            actionId: 'command',
            command: 'ref.showAll:f1',
          },
        ])}
      />
    )
    openDropdown()
    fireEvent.mouseDown(screen.getByRole('button', { name: showAllName }))
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'ref.showAll:f1',
      sourceNodeId: 'f1',
    })
  })

  // ── открыть ──
  it('openAction + allowOpen === true + выбрано значение → клик диспатчит команду открытия', () => {
    state.ref = { id: 1, presentation: 'Запись 1' }
    render(
      <ReferenceFieldNode
        node={makeNode({ allowOpen: true }, [
          { trigger: 'open', actionId: 'command', command: 'ref.open:f1' },
        ])}
      />
    )
    fireEvent.mouseDown(screen.getByRole('button', { name: openName }))
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'ref.open:f1',
      sourceNodeId: 'f1',
    })
    expect(openPickerMock).not.toHaveBeenCalled()
  })

  it('openAction есть, allowOpen !== true + выбрано значение → открыть недоступно (ни action, ни легаси)', () => {
    state.ref = { id: 1, presentation: 'Запись 1' }
    render(
      <ReferenceFieldNode
        node={makeNode({ allowOpen: false }, [
          { trigger: 'open', actionId: 'command', command: 'ref.open:f1' },
        ])}
      />
    )
    expect(screen.queryByRole('button', { name: openName })).toBeNull()
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(openPickerMock).not.toHaveBeenCalled()
  })

  // ── скопировать ──
  it('copyAction + allowCopy === true + выбрано значение → клик диспатчит команду копирования', () => {
    state.ref = { id: 1, presentation: 'Запись 1' }
    render(
      <ReferenceFieldNode
        node={makeNode({ allowCopy: true }, [
          { trigger: 'copy', actionId: 'command', command: 'ref.copy:f1' },
        ])}
      />
    )
    fireEvent.mouseDown(screen.getByRole('button', { name: copyName }))
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'ref.copy:f1',
      sourceNodeId: 'f1',
    })
  })

  it('copyAction есть, allowCopy !== true → «Скопировать» не показывается', () => {
    state.ref = { id: 1, presentation: 'Запись 1' }
    render(
      <ReferenceFieldNode
        node={makeNode({ allowCopy: false }, [
          { trigger: 'copy', actionId: 'command', command: 'ref.copy:f1' },
        ])}
      />
    )
    expect(screen.queryByRole('button', { name: copyName })).toBeNull()
  })

  // ── §18.6: легаси-фолбэк сохраняется, когда action отсутствует вовсе ──
  describe('без action — легаси-фолбэк через gateway (§18.6, не C1)', () => {
    it('нет showAllAction, canBrowse → «Показать все» открывает легаси-пикер list', () => {
      render(<ReferenceFieldNode node={makeNode({})} />)
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: showAllName }))
      expect(openPickerMock).toHaveBeenCalledTimes(1)
      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'list',
        domain: 'DICTIONARY',
        typeCode: 'Organizatsii',
      })
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('нет createAction, canBrowse → «Создать» открывает легаси-пикер create', () => {
      render(<ReferenceFieldNode node={makeNode({})} />)
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: addName }))
      expect(openPickerMock).toHaveBeenCalledTimes(1)
      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'create',
        domain: 'DICTIONARY',
        typeCode: 'Organizatsii',
      })
    })

    it('нет openAction, canBrowse, выбрано значение → иконка открывает легаси-пикер edit', () => {
      state.ref = { id: 1, presentation: 'Запись 1' }
      render(<ReferenceFieldNode node={makeNode({})} />)
      fireEvent.mouseDown(screen.getByRole('button', { name: openName }))
      expect(openPickerMock).toHaveBeenCalledTimes(1)
      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'edit',
        domain: 'DICTIONARY',
        typeCode: 'Organizatsii',
        entryId: 1,
      })
      expect(mockDispatch).not.toHaveBeenCalled()
    })
  })
})

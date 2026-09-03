import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as I18next from 'react-i18next'

import type { ViewNode } from '../../../types/view'
import { SelectionListTable } from './selection-list-table'

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof I18next>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}))

const dispatch = vi.fn()
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))

const openPickerMock = vi.fn<(req: Record<string, unknown>) => void>()
vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: (req: Record<string, unknown>) => {
    openPickerMock(req)
  },
}))

const state: Record<string, unknown> = {}
const setFromServer = vi.fn()
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (k: string) => state[k],
    setFromServer: (k: string, v: unknown) => {
      setFromServer(k, v)
    },
  }),
}))

const node = {
  id: 'table.otborSotrudnikov',
  type: 'TABLE',
  binding: 'OtborSotrudnikov',
  props: { selectionList: true, label: 'Отбор по сотруднику' },
  children: [
    {
      id: 'table.otborSotrudnikov.col.Sotrudnik',
      type: 'TABLE_COLUMN',
      binding: 'Sotrudnik',
      props: { label: 'Сотрудник' },
    },
  ],
} as unknown as ViewNode

describe('список-отбор', () => {
  beforeEach(() => {
    cleanup()
    setFromServer.mockClear()
    dispatch.mockClear()
    openPickerMock.mockClear()
    state.OtborSotrudnikov = [
      { rowId: '1', Sotrudnik: { id: 1, presentation: 'Иванов' } },
      { rowId: '2', Sotrudnik: { id: 2, presentation: 'Петров' } },
    ]
  })

  it('клик по строке публикует выбор под ключом master-detail', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.click(screen.getByText('Иванов'))

    expect(setFromServer).toHaveBeenCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      '1'
    )
  })

  it('повторный клик по выбранной строке снимает отбор', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.click(screen.getByText('Петров'))
    fireEvent.click(screen.getByText('Петров'))

    expect(setFromServer).toHaveBeenLastCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      null
    )
  })

  it('кнопка «Показать всех» доступна только при выбранной строке и снимает отбор', () => {
    render(<SelectionListTable node={node} />)
    const button = screen.getByRole('button', { name: 'table.clearFilter' })
    expect(button).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByText('Иванов'))
    fireEvent.click(screen.getByRole('button', { name: 'table.clearFilter' }))

    expect(setFromServer).toHaveBeenLastCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      null
    )
  })

  it('выбор уходит EVENT-ом на сервер: от него зависят свод и подвалы «Итого»', async () => {
    const sSobytiem = {
      ...node,
      actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
    } as unknown as ViewNode
    render(<SelectionListTable node={sSobytiem} />)

    fireEvent.click(screen.getByText('Иванов'))

    // Отправка сериализована через очередь промисов (см. тест ниже) — dispatch
    // вызывается на следующем микротаске, а не синхронно с кликом.
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EVENT',
          sourceNodeId: 'table.otborSotrudnikov',
          trigger: 'change',
          value: expect.objectContaining({ rowId: '1' }),
        })
      )
    })
  })

  it('быстрые клики по разным строкам сериализуют EVENT — второй ждёт ответа на первый', async () => {
    // Воспроизводит гонку со стенда 03.09.2026: dispatch.ts даёт in-flight-гард
    // только action.type === 'COMMAND', EVENT им не защищён. Без сериализации
    // оба запроса ушли бы сразу, и ответ на «Андосов» мог применить свои patches
    // ПОСЛЕ ответа на «Аубакиров», откатив суммы подвалов на прошлого сотрудника.
    const sSobytiem = {
      ...node,
      actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
    } as unknown as ViewNode
    let resolveFirst: (() => void) | undefined
    const firstResponse = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    dispatch.mockImplementationOnce(() => firstResponse)
    dispatch.mockImplementationOnce(() => Promise.resolve())

    render(<SelectionListTable node={sSobytiem} />)

    fireEvent.click(screen.getByText('Иванов'))
    fireEvent.click(screen.getByText('Петров'))

    // Первый dispatch тоже уходит на следующем микротаске (см. тест выше).
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(1)
    })
    // Второй клик не отправлен, пока ответ на первый не пришёл — и не отправится
    // без явного resolveFirst(), сколько микротасков ни жди.
    await Promise.resolve()
    await Promise.resolve()
    expect(dispatch).toHaveBeenCalledTimes(1)

    resolveFirst?.()
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(2)
    })
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({ rowId: '2' }),
      })
    )
  })

  it('без объявленного действия EVENT не шлётся', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.click(screen.getByText('Иванов'))

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('пустой список показывает заглушку, а не пустую таблицу', () => {
    state.OtborSotrudnikov = []
    render(<SelectionListTable node={node} />)

    expect(screen.getByText('table.empty')).toBeTruthy()
  })

  it('поиск сужает список по подстроке в любой видимой колонке, без учёта регистра', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.change(screen.getByPlaceholderText('table.searchPlaceholder'), {
      target: { value: 'иван' },
    })

    expect(screen.getByText('Иванов')).toBeTruthy()
    expect(screen.queryByText('Петров')).toBeNull()
  })

  it('очистка поиска возвращает полный список', () => {
    render(<SelectionListTable node={node} />)
    const search = screen.getByPlaceholderText('table.searchPlaceholder')

    fireEvent.change(search, { target: { value: 'Петров' } })
    expect(screen.queryByText('Иванов')).toBeNull()

    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getByText('Иванов')).toBeTruthy()
    expect(screen.getByText('Петров')).toBeTruthy()
  })

  it('поиск — чисто клиентский: не публикует выбор и не шлёт EVENT', () => {
    const sSobytiem = {
      ...node,
      actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
    } as unknown as ViewNode
    render(<SelectionListTable node={sSobytiem} />)

    fireEvent.change(screen.getByPlaceholderText('table.searchPlaceholder'), {
      target: { value: 'Иванов' },
    })

    expect(setFromServer).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('нет совпадений по запросу — та же заглушка, что у пустого списка', () => {
    render(<SelectionListTable node={node} />)

    fireEvent.change(screen.getByPlaceholderText('table.searchPlaceholder'), {
      target: { value: 'нет такого' },
    })

    expect(screen.getByText('table.empty')).toBeTruthy()
  })

  it('без domain/targetTypeCode в props кнопки «Показать всех сотрудников» нет', () => {
    render(<SelectionListTable node={node} />)

    expect(screen.queryByText('table.showAllEmployees')).toBeNull()
  })

  it('«Показать всех сотрудников» открывает справочник с фильтром по организации', () => {
    const sDomenom = {
      ...node,
      props: {
        ...node.props,
        domain: 'DICTIONARY',
        targetTypeCode: 'Sotrudniki',
        filter: { Organizatsiya: 555 },
      },
    } as unknown as ViewNode
    render(<SelectionListTable node={sDomenom} />)

    fireEvent.click(screen.getByText('Иванов'))
    fireEvent.click(screen.getByText('table.showAllEmployees'))

    expect(openPickerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'list',
        domain: 'DICTIONARY',
        typeCode: 'Sotrudniki',
        searchParams: { Organizatsiya: '555' },
        selectedId: '1',
      })
    )
  })

  it('«Показать всех сотрудников»: выбор уже видимой строки публикует её целиком (с FizicheskoeLitso)', () => {
    state.OtborSotrudnikov = [
      {
        rowId: '1',
        Sotrudnik: { id: 1, presentation: 'Иванов' },
        FizicheskoeLitso: { id: 101, presentation: 'Иванов ФЛ' },
      },
    ]
    const sDomenom = {
      ...node,
      props: {
        ...node.props,
        domain: 'DICTIONARY',
        targetTypeCode: 'Sotrudniki',
      },
    } as unknown as ViewNode
    render(<SelectionListTable node={sDomenom} />)

    fireEvent.click(screen.getByText('table.showAllEmployees'))
    const onSelect = openPickerMock.mock.calls[0][0].onSelect as (
      opt: { id: number; code: string; label: string } | null
    ) => void
    onSelect({ id: 1, code: '1', label: 'Иванов' })

    expect(setFromServer).toHaveBeenCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      '1'
    )
  })

  it('«Показать всех сотрудников»: выбор сотрудника вне ТЧ строит минимальную строку', () => {
    const sDomenom = {
      ...node,
      props: {
        ...node.props,
        domain: 'DICTIONARY',
        targetTypeCode: 'Sotrudniki',
      },
    } as unknown as ViewNode
    render(<SelectionListTable node={sDomenom} />)

    fireEvent.click(screen.getByText('table.showAllEmployees'))
    const onSelect = openPickerMock.mock.calls[0][0].onSelect as (
      opt: { id: number; code: string; label: string } | null
    ) => void
    onSelect({ id: 99, code: '99', label: 'Сидоров' })

    expect(setFromServer).toHaveBeenCalledWith(
      'OtborSotrudnikov.__selectedRowId',
      '99'
    )
  })
})

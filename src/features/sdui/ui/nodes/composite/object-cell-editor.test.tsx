import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ObjectCellEditor } from './object-cell-editor'
import {
  setReferencePickerGateway,
  type ReferencePickerRequest,
} from '../../../lib/reference-picker-gateway'

// i18n в тестах не инициализирован — подписи проверяем по ключам.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
// Опции справочника здесь не предмет проверки — сеть не трогаем.
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: () => Promise.resolve([]),
}))

const SCHET_K_OPLATE = {
  position: 1,
  domainKind: 'DOCUMENT',
  targetTypeCode: 'SchetKOplate',
  presentation: 'Счет к оплате',
  optionsSource: { url: '/api/document-entries/SchetKOplate/entries' },
}
const PKO = {
  position: 2,
  domainKind: 'DOCUMENT',
  targetTypeCode: 'PrikhodnyyKassovyyOrder',
  presentation: 'Приходный кассовый ордер',
  optionsSource: {
    url: '/api/document-entries/PrikhodnyyKassovyyOrder/entries',
  },
}
/** Примитивный член: цели ссылки и списка у него нет (SCRUM-279). */
const STROKA = { position: 3, domainKind: 'STRING' }

const colProps = (types: unknown[]) => ({ allowedTypes: types })

let picker: ReferencePickerRequest[] = []

beforeEach(() => {
  picker = []
  setReferencePickerGateway((req) => {
    picker.push(req)
  })
})

afterEach(() => {
  setReferencePickerGateway(null)
  cleanup()
})

/**
 * Составное поле в ячейке ТЧ: выбор типа — ШАГ, а не отдельное поле-соседка
 * (жалоба 07.09.2026 по «Документу аванса» авансового отчёта). Проверяем ровно
 * эталонную последовательность 1С: пустая ячейка → «Выбор типа данных» → СРАЗУ
 * список записей выбранного типа.
 */
describe('ObjectCellEditor: выбор типа и список', () => {
  it('пустая ячейка не несёт отдельного поля с типом — только приглашение выбрать', () => {
    render(
      <ObjectCellEditor
        colProps={colProps([SCHET_K_OPLATE, PKO])}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )

    expect(screen.getByText('sdui.objectField.choosePlaceholder')).toBeTruthy()
    // Ни combobox значения, ни селектора типа до выбора типа нет
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('клик по приглашению открывает меню со ВСЕМИ допустимыми типами', () => {
    render(
      <ObjectCellEditor
        colProps={colProps([SCHET_K_OPLATE, PKO, STROKA])}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('sdui.objectField.choosePlaceholder'))

    expect(screen.getByRole('menuitem', { name: 'Счет к оплате' })).toBeTruthy()
    expect(
      screen.getByRole('menuitem', { name: 'Приходный кассовый ордер' })
    ).toBeTruthy()
    // Примитивный член подписан ключом типа 1С, а не пустой строкой
    expect(
      screen.getByRole('menuitem', {
        name: 'sdui.objectField.primitive.STRING',
      })
    ).toBeTruthy()
  })

  it('после выбора типа СРАЗУ открывается список записей этого типа', () => {
    render(
      <ObjectCellEditor
        colProps={colProps([SCHET_K_OPLATE, PKO])}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('sdui.objectField.choosePlaceholder'))
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Приходный кассовый ордер' })
    )

    expect(picker).toHaveLength(1)
    expect(picker[0]).toMatchObject({
      mode: 'list',
      domain: 'DOCUMENT',
      typeCode: 'PrikhodnyyKassovyyOrder',
    })
  })

  it('выбор записи в списке кладёт значение с типом и коммитит строку', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <ObjectCellEditor
        colProps={colProps([SCHET_K_OPLATE, PKO])}
        value={null}
        onChange={onChange}
        onCommit={onCommit}
      />
    )

    fireEvent.click(screen.getByText('sdui.objectField.choosePlaceholder'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Счет к оплате' }))
    picker[0].onSelect({ id: 42, code: '42', label: 'Счет к оплате № 8' })

    expect(onChange).toHaveBeenCalledWith({
      id: 42,
      presentation: 'Счет к оплате № 8',
      type: 'DOCUMENT',
      targetTypeCode: 'SchetKOplate',
    })
    expect(onCommit).toHaveBeenCalled()
  })

  it('примитивный член списка не имеет — пикер не открывается', () => {
    render(
      <ObjectCellEditor
        colProps={colProps([SCHET_K_OPLATE, STROKA])}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('sdui.objectField.choosePlaceholder'))
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'sdui.objectField.primitive.STRING',
      })
    )

    expect(picker).toHaveLength(0)
  })

  it('заполненная ячейка показывает значение без соседнего поля с типом', () => {
    render(
      <ObjectCellEditor
        colProps={colProps([SCHET_K_OPLATE, PKO])}
        value={{
          id: 7,
          presentation: 'Счет к оплате ABZ00-00008',
          type: 'DOCUMENT',
          targetTypeCode: 'SchetKOplate',
        }}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )

    // Ровно один контрол — сам пикер значения
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.queryByText('sdui.objectField.choosePlaceholder')).toBeNull()
  })
})

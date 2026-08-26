import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { SelectOption } from '@/shared/types/select-option'
import { ReferenceCellEditor } from './reference-cell-editor'

const fetchMock = vi.fn<(...args: unknown[]) => Promise<SelectOption[]>>()
vi.mock('../../../api/reference-options', () => ({
  fetchReferenceOptions: (...args: unknown[]) => fetchMock(...args),
}))

const openPickerMock = vi.fn<(req: Record<string, unknown>) => void>()
vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: (req: Record<string, unknown>) => {
    openPickerMock(req)
  },
}))

/** Футер живёт в Paper автокомплита — он существует только у открытого списка. */
const openDropdown = () => {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
}

describe('ReferenceCellEditor', () => {
  afterEach(cleanup)

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue([{ id: 5, code: '5', label: 'ИПН 10%' }])
    openPickerMock.mockReset()
  })

  it('выбор опции → onChange({id, presentation}) + onCommit', async () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <ReferenceCellEditor
        colProps={{
          optionsSource: { url: '/api/dictionary-entries/VychetyIPN/entries' },
        }}
        value={null}
        onChange={onChange}
        onCommit={onCommit}
      />
    )
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByText('ИПН 10%'))
    expect(onChange).toHaveBeenCalledWith({ id: 5, presentation: 'ИПН 10%' })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('текущее значение показывает presentation, не объект', () => {
    render(
      <ReferenceCellEditor
        colProps={{ optionsSource: { url: '/x' } }}
        value={{ id: '5', presentation: 'ИПН 10%' }}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe('ИПН 10%')
  })

  it('без optionsSource и targetTypeCode — нейтральное отображение, не падает', () => {
    render(
      <ReferenceCellEditor
        colProps={{}}
        value={{ id: 1, presentation: 'Значение' }}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )
    expect(screen.getByText('Значение')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  // ── SCRUM-314 §1–§5: футер «Показать все» / «Добавить» в ячейке ТЧ ──
  //
  // В легаси-форме футер у ссылочной ячейки есть, в SDUI не было: ячейку рисует
  // другой компонент, и он не прокидывал колбэки в общий AutocompleteInput
  // (тот включает футер по `!!(onShowAll || onAdd)`). Бэк все нужные props
  // отдавал и до этой правки.
  describe('футер пикера', () => {
    // i18n в юнит-тестах не инициализирован — t() возвращает ключ. Матчим и
    // ключ, и русскую подпись, чтобы тест пережил подключение ресурсов.
    const showAllName = /showAll|Показать все/i
    const addName = /dictSidebar\.add|Добавить/i

    const cellProps = (extra: Record<string, unknown>) => ({
      optionsSource: { url: '/api/x/sdui-entries' },
      domain: 'DICTIONARY',
      targetTypeCode: 'VidyStazha',
      ...extra,
    })

    it('allowShowAll: true → «Показать все» открывает пикер в режиме list', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({ allowShowAll: true })}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: showAllName }))

      expect(openPickerMock).toHaveBeenCalledTimes(1)
      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'list',
        domain: 'DICTIONARY',
        typeCode: 'VidyStazha',
      })
    })

    it('заполненная ячейка → пикер открывается на текущей записи', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({ allowShowAll: true })}
          value={{ id: 7, presentation: 'Запасные части' }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: showAllName }))

      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'list',
        selectedId: 7,
      })
    })

    it('пустая ячейка → selectedId не шлём', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({ allowShowAll: true })}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: showAllName }))

      expect(openPickerMock.mock.calls[0][0].selectedId).toBeUndefined()
    })

    it('allowCreate: true и domain=DICTIONARY → «Добавить» есть', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({ allowCreate: true })}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: addName }))

      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'create',
        domain: 'DICTIONARY',
        typeCode: 'VidyStazha',
      })
    })

    // Спека §2: бэк считает allowCreate по dataType == DICTIONARY, а это в
    // модели значит «ссылка вообще», не «цель — справочник». Реальный домен —
    // в props.domain. У «Вида начисления» приходит allowCreate: true при
    // domain = CALCULATION_PLAN, и создание элемента справочника там не
    // сработает — кнопку гейтим по домену, иначе она заведомо битая.
    it('allowCreate: true, но domain=CALCULATION_PLAN → «Добавить» отсутствует', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({
            allowCreate: true,
            allowShowAll: true,
            domain: 'CALCULATION_PLAN',
            targetTypeCode: 'VidyNachisleniyOrganizatsii',
          })}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()

      // «Показать все» по домену НЕ гейтим — список открывается для любого.
      expect(screen.getByRole('button', { name: showAllName })).toBeTruthy()
      expect(screen.queryByRole('button', { name: addName })).toBeNull()
    })

    it('allowShowAll: false, allowCreate: false → футера нет вовсе', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({ allowShowAll: false, allowCreate: false })}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      expect(screen.queryByRole('button', { name: showAllName })).toBeNull()
      expect(screen.queryByRole('button', { name: addName })).toBeNull()
    })

    // Инвариант A4: цель ссылки неизвестна → пикер открывать не по чему.
    it('без targetTypeCode футера нет, даже если allow* пришли', () => {
      render(
        <ReferenceCellEditor
          colProps={{
            optionsSource: { url: '/api/x/sdui-entries' },
            domain: 'DICTIONARY',
            allowShowAll: true,
            allowCreate: true,
          }}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      expect(screen.queryByRole('button', { name: showAllName })).toBeNull()
      expect(screen.queryByRole('button', { name: addName })).toBeNull()
    })

    it('выбор из пикера кладёт в ячейку {id, presentation} и коммитит', () => {
      const onChange = vi.fn()
      const onCommit = vi.fn()
      render(
        <ReferenceCellEditor
          colProps={cellProps({ allowShowAll: true })}
          value={null}
          onChange={onChange}
          onCommit={onCommit}
        />
      )
      openDropdown()
      fireEvent.mouseDown(screen.getByRole('button', { name: showAllName }))

      // Пикер отдаёт выбранный элемент тем же колбэком, что и дропдаун.
      const req = openPickerMock.mock.calls[0][0] as {
        onSelect: (o: SelectOption) => void
      }
      req.onSelect({ id: 42, code: '42', label: 'Общий стаж' })

      expect(onChange).toHaveBeenCalledWith({
        id: 42,
        presentation: 'Общий стаж',
      })
      expect(onCommit).toHaveBeenCalledTimes(1)
    })

    it('allowCreate отсутствует → «Добавить» НЕТ (запрещающий дефолт, аудит F-21)', () => {
      render(
        <ReferenceCellEditor
          colProps={cellProps({})}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )
      openDropdown()
      // Футер существует (allowShowAll ?? true), но кнопки создания в нём нет:
      expect(screen.getByRole('button', { name: showAllName })).toBeTruthy()
      expect(screen.queryByRole('button', { name: addName })).toBeNull()
    })
  })

  // ── SCRUM-291 §18.4.1: проваливание из заполненной ячейки ТЧ ──
  //
  // Это НЕ пикер (§18.4, заблокирован PM) — иконка открывает карточку УЖЕ
  // стоящей в ячейке записи: читает {id, presentation} из значения, никакой
  // командной модели с rowId не нужно (нестабильный rowId сюда не относится).
  describe('открыть карточку записи (§18.4.1)', () => {
    const openCardName = /inputs\.openReference|Открыть запись/i

    it('заполненная ячейка + domain/targetTypeCode → иконка есть, клик открывает карточку, выбор в карточке пишет назад {id, presentation}', () => {
      const onChange = vi.fn()
      const onCommit = vi.fn()
      render(
        <ReferenceCellEditor
          colProps={{
            optionsSource: { url: '/api/x/sdui-entries' },
            domain: 'DICTIONARY',
            targetTypeCode: 'VidyStazha',
          }}
          value={{ id: 5, presentation: 'ИПН 10%' }}
          onChange={onChange}
          onCommit={onCommit}
        />
      )
      const button = screen.getByRole('button', { name: openCardName })
      fireEvent.mouseDown(button)
      expect(openPickerMock).toHaveBeenCalledTimes(1)
      expect(openPickerMock.mock.calls[0][0]).toMatchObject({
        mode: 'edit',
        domain: 'DICTIONARY',
        typeCode: 'VidyStazha',
        entryId: 5,
      })
      // Карточка резолвится тем же onSelect, что и пикер — проверяем запись обратно.
      const req = openPickerMock.mock.calls[0][0] as {
        onSelect: (o: SelectOption) => void
      }
      req.onSelect({ id: 9, code: '9', label: 'Общий стаж' })

      expect(onChange).toHaveBeenCalledWith({
        id: 9,
        presentation: 'Общий стаж',
      })
      expect(onCommit).toHaveBeenCalledTimes(1)
    })

    it('пустая ячейка (нет значения) → иконки нет', () => {
      render(
        <ReferenceCellEditor
          colProps={{
            optionsSource: { url: '/api/x/sdui-entries' },
            domain: 'DICTIONARY',
            targetTypeCode: 'VidyStazha',
          }}
          value={null}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )

      expect(screen.queryByRole('button', { name: openCardName })).toBeNull()
    })

    it('нет domain/targetTypeCode → иконки нет, даже если ячейка заполнена', () => {
      render(
        <ReferenceCellEditor
          colProps={{ optionsSource: { url: '/api/x/sdui-entries' } }}
          value={{ id: 1, presentation: 'Значение' }}
          onChange={vi.fn()}
          onCommit={vi.fn()}
        />
      )

      expect(screen.queryByRole('button', { name: openCardName })).toBeNull()
    })
  })
})

// Ширина колонки ТЧ фиксирована, а <input> длинное наименование не переносит, а
// прокручивает: в ячейке видно «Надбавка за ос…» вместо полного значения.
describe('ReferenceCellEditor — перенос значения по ширине колонки', () => {
  afterEach(cleanup)

  it('поле ячейки — textarea (multiline), а не однострочный input', () => {
    const { container } = render(
      <ReferenceCellEditor
        colProps={{ optionsSource: { url: '/x' } }}
        value={{ id: 5, presentation: 'Надбавка за особые условия труда 10%' }}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />
    )
    const field = screen.getByRole('combobox')
    expect(field.tagName).toBe('TEXTAREA')
    expect((field as HTMLTextAreaElement).value).toBe(
      'Надбавка за особые условия труда 10%'
    )
    // Однострочного input в ячейке не остаётся — иначе значение снова обрежется.
    expect(container.querySelector('input')).toBeNull()
  })
})

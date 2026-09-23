import { describe, expect, it, vi } from 'vitest'

import {
  createTableHotkeysHandler,
  type TableHotkeyHandlers,
} from './table-hotkeys'

function makeHandlers(): TableHotkeyHandlers {
  return {
    onAdd: vi.fn(),
    onCopy: vi.fn(),
    onRemove: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onSelectPrev: vi.fn(),
    onSelectNext: vi.fn(),
    onFocusSearch: vi.fn(),
    onClearSearch: vi.fn(),
    onSelectAll: vi.fn(),
    onExtendPrev: vi.fn(),
    onExtendNext: vi.fn(),
    onCopyToClipboard: vi.fn(),
    onUndo: vi.fn(),
    onSave: vi.fn(),
  }
}

function keyEvent(
  init: Partial<{
    key: string
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
    targetTag: string
  }>
) {
  const target = document.createElement(init.targetTag ?? 'div')
  return {
    key: init.key ?? '',
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
    target,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLElement>
}

describe('createTableHotkeysHandler (SCRUM-302)', () => {
  it('Insert/F9/Delete зовут add/copy/remove вне инпута', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'Insert' }))
    onKeyDown(keyEvent({ key: 'F9' }))
    onKeyDown(keyEvent({ key: 'Delete' }))
    expect(h.onAdd).toHaveBeenCalled()
    expect(h.onCopy).toHaveBeenCalled()
    expect(h.onRemove).toHaveBeenCalled()
  })

  it('в инпуте ячейки Insert/F9/Delete игнорируются', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'Delete', targetTag: 'input' }))
    onKeyDown(keyEvent({ key: 'Insert', targetTag: 'input' }))
    onKeyDown(keyEvent({ key: 'F9', targetTag: 'textarea' }))
    expect(h.onRemove).not.toHaveBeenCalled()
    expect(h.onAdd).not.toHaveBeenCalled()
    expect(h.onCopy).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+стрелки двигают строку (и в инпуте тоже)', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const eUp = keyEvent({
      key: 'ArrowUp',
      ctrlKey: true,
      shiftKey: true,
      targetTag: 'input',
    })
    const eDown = keyEvent({ key: 'ArrowDown', ctrlKey: true, shiftKey: true })
    onKeyDown(eUp)
    onKeyDown(eDown)
    expect(h.onMoveUp).toHaveBeenCalled()
    expect(h.onMoveDown).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eUp.preventDefault).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(eDown.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+F, Cmd+F и Ctrl+Alt+F фокусируют поиск с preventDefault', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const e1 = keyEvent({ key: 'f', ctrlKey: true })
    const e2 = keyEvent({ key: 'f', metaKey: true })
    const e3 = keyEvent({ key: 'F', ctrlKey: true, altKey: true })
    onKeyDown(e1)
    onKeyDown(e2)
    onKeyDown(e3)
    expect(h.onFocusSearch).toHaveBeenCalledTimes(3)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e1.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+Q сбрасывает поиск', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const e = keyEvent({ key: 'q', ctrlKey: true })
    onKeyDown(e)
    expect(h.onClearSearch).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Cmd+Q НЕ сбрасывает поиск (только Ctrl+Q)', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'q', metaKey: true, ctrlKey: false }))
    expect(h.onClearSearch).not.toHaveBeenCalled()
  })

  it('обычные клавиши не трогают ничего', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'a' }))
    onKeyDown(keyEvent({ key: 'Enter', targetTag: 'input' }))

    for (const fn of Object.values(h)) expect(fn).not.toHaveBeenCalled()
  })

  it('стрелки ↑/↓ водят по строкам — платформенное поведение таблицы 1С', () => {
    // Обращение 20.09.2026 (доверенность): «стрелочками спускаться вниз или вверх —
    // таблица не реагирует, приходится колесиком мышки».
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)

    onKeyDown(keyEvent({ key: 'ArrowDown' }))
    onKeyDown(keyEvent({ key: 'ArrowUp' }))

    expect(h.onSelectNext).toHaveBeenCalledTimes(1)
    expect(h.onSelectPrev).toHaveBeenCalledTimes(1)
  })

  it('внутри ячейки стрелки остаются за курсором ввода', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)

    onKeyDown(keyEvent({ key: 'ArrowDown', targetTag: 'input' }))
    onKeyDown(keyEvent({ key: 'ArrowUp', targetTag: 'textarea' }))

    expect(h.onSelectNext).not.toHaveBeenCalled()
    expect(h.onSelectPrev).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+стрелки по-прежнему переставляют строку, а не переходят по ней', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)

    onKeyDown(keyEvent({ key: 'ArrowDown', ctrlKey: true, shiftKey: true }))

    expect(h.onMoveDown).toHaveBeenCalledTimes(1)
    expect(h.onSelectNext).not.toHaveBeenCalled()
  })
})

describe('выделение нескольких строк (порт таблицы 1С)', () => {
  it('Ctrl+A выделяет все строки таблицы', () => {
    const handlers = makeHandlers()
    const e = keyEvent({ key: 'a', ctrlKey: true })
    createTableHotkeysHandler(handlers)(e as never)
    expect(handlers.onSelectAll).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+A внутри ячейки остаётся выделением текста', () => {
    const handlers = makeHandlers()
    const e = keyEvent({ key: 'a', ctrlKey: true, targetTag: 'input' })
    createTableHotkeysHandler(handlers)(e as never)
    expect(handlers.onSelectAll).not.toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('Shift и стрелки расширяют выделение, а не просто переводят строку', () => {
    const handlers = makeHandlers()
    createTableHotkeysHandler(handlers)(
      keyEvent({ key: 'ArrowDown', shiftKey: true }) as never
    )
    createTableHotkeysHandler(handlers)(
      keyEvent({ key: 'ArrowUp', shiftKey: true }) as never
    )
    expect(handlers.onExtendNext).toHaveBeenCalledTimes(1)
    expect(handlers.onExtendPrev).toHaveBeenCalledTimes(1)
    expect(handlers.onSelectNext).not.toHaveBeenCalled()
    expect(handlers.onSelectPrev).not.toHaveBeenCalled()
  })
})

describe('буфер обмена, отмена и запись (порт хоткеев таблицы 1С)', () => {
  it('Ctrl+C копирует выделенные строки, Cmd+C — тоже', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const e = keyEvent({ key: 'c', ctrlKey: true })
    onKeyDown(e)
    onKeyDown(keyEvent({ key: 'C', metaKey: true }))
    expect(h.onCopyToClipboard).toHaveBeenCalledTimes(2)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+C внутри ячейки остаётся копированием текста', () => {
    const h = makeHandlers()
    const e = keyEvent({ key: 'c', ctrlKey: true, targetTag: 'input' })
    createTableHotkeysHandler(h)(e)
    expect(h.onCopyToClipboard).not.toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('Ctrl+Z отменяет последнее действие, а в ячейке — ввод символов', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const e = keyEvent({ key: 'z', ctrlKey: true })
    onKeyDown(e)
    onKeyDown(keyEvent({ key: 'z', ctrlKey: true, targetTag: 'input' }))
    expect(h.onUndo).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+S записывает документ И из ячейки: значение уже в снимке ТЧ', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    const e = keyEvent({ key: 's', ctrlKey: true, targetTag: 'input' })
    onKeyDown(e)
    expect(h.onSave).toHaveBeenCalledTimes(1)
    // Диалог «Сохранить страницу» браузера в форме документа не нужен никогда
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('Ctrl+V не перехватывается хоткеем — вставку принимает событие paste', () => {
    const h = makeHandlers()
    const e = keyEvent({ key: 'v', ctrlKey: true })
    createTableHotkeysHandler(h)(e)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})

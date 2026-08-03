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
    onFocusSearch: vi.fn(),
    onClearSearch: vi.fn(),
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
    onKeyDown(
      keyEvent({
        key: 'ArrowUp',
        ctrlKey: true,
        shiftKey: true,
        targetTag: 'input',
      })
    )
    onKeyDown(keyEvent({ key: 'ArrowDown', ctrlKey: true, shiftKey: true }))
    expect(h.onMoveUp).toHaveBeenCalled()
    expect(h.onMoveDown).toHaveBeenCalled()
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
    onKeyDown(keyEvent({ key: 'q', ctrlKey: true }))
    expect(h.onClearSearch).toHaveBeenCalled()
  })

  it('обычные клавиши не трогают ничего', () => {
    const h = makeHandlers()
    const onKeyDown = createTableHotkeysHandler(h)
    onKeyDown(keyEvent({ key: 'a' }))
    onKeyDown(keyEvent({ key: 'Enter', targetTag: 'input' }))

    for (const fn of Object.values(h)) expect(fn).not.toHaveBeenCalled()
  })
})

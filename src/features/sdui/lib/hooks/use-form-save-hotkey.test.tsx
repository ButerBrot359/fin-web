import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFormSaveHotkey } from './use-form-save-hotkey'

const mockSave = vi.fn()
vi.mock('./use-form-save-command', () => ({
  useFormSaveCommand: () => mockSave,
}))

const ctrlS = (target: EventTarget, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(e)
  return e
}

describe('useFormSaveHotkey (Ctrl+S из любого места формы)', () => {
  let root: HTMLDivElement
  let forma: HTMLDivElement
  let pole: HTMLInputElement

  beforeEach(() => {
    mockSave.mockClear()
    root = document.createElement('div')
    forma = document.createElement('div')
    pole = document.createElement('input')
    forma.appendChild(pole)
    root.appendChild(forma)
    document.body.appendChild(root)
    renderHook(() => {
      useFormSaveHotkey({ current: root })
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('из поля шапки записывает форму и гасит диалог браузера', () => {
    const e = ctrlS(pole)
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
  })

  it('поле теряет фокус до записи — его change уходит раньше команды', () => {
    const poryadok: string[] = []
    pole.addEventListener('blur', () => poryadok.push('blur'))
    mockSave.mockImplementation(() => poryadok.push('save'))
    pole.focus()
    ctrlS(pole)
    expect(poryadok).toEqual(['blur', 'save'])
    mockSave.mockReset()
  })

  it('русская раскладка: Ctrl+Ы — та же клавиша S', () => {
    ctrlS(pole, { key: 'ы', code: 'KeyS' })
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('Cmd+S на mac — то же', () => {
    ctrlS(pole, { ctrlKey: false, metaKey: true })
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('табличная часть уже записала — второй записи нет', () => {
    pole.addEventListener('keydown', (e) => {
      e.preventDefault()
    })
    ctrlS(pole)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('вне экрана формы не срабатывает', () => {
    const chuzhoe = document.createElement('input')
    document.body.appendChild(chuzhoe)
    const e = ctrlS(chuzhoe)
    expect(mockSave).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(false)
  })

  it('в диалоге поверх формы не срабатывает', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const vDialoge = document.createElement('input')
    dialog.appendChild(vDialoge)
    root.appendChild(dialog)
    ctrlS(vDialoge)
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+S и Ctrl+Alt+S не трогает', () => {
    ctrlS(pole, { shiftKey: true })
    ctrlS(pole, { altKey: true })
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('фокус на фоне страницы: пишет только видимая форма', () => {
    vi.spyOn(forma, 'getClientRects').mockReturnValue([
      {},
    ] as unknown as DOMRectList)
    ctrlS(document.body)
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('фокус на фоне, а форма спрятана под панельной вкладкой — молчит', () => {
    ctrlS(document.body)
    expect(mockSave).not.toHaveBeenCalled()
  })
})

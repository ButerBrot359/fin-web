import { useEffect, useState } from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePanelStore, type PanelEntry } from '../lib/stores/panel-store'
import { DialogHost } from './dialog-host'

// Сколько раз смонтировался узел каждой панели. Перемонтирование родителя —
// это обнулённые правки окна строки, поэтому проверяем именно счётчик, а не
// «виден ли элемент».
const mounts = new Map<string, number>()

vi.mock('./node-renderer', () => ({
  NodeRenderer: ({ node }: { node: { id: string } }) => {
    const [typed, setTyped] = useState('')
    useEffect(() => {
      mounts.set(node.id, (mounts.get(node.id) ?? 0) + 1)
    }, [node.id])
    return (
      <input
        data-testid={`node-${node.id}`}
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value)
        }}
      />
    )
  },
}))

vi.mock('./confirm-dialog-host', () => ({ ConfirmDialogHost: () => null }))
vi.mock('./unsaved-changes-host', () => ({ UnsavedChangesHost: () => null }))
// PanelCloseCommand — мост крестика к серверной команде: тянет весь стек
// dispatch (router + query-client). Хост стека панелей проверяется без него.
vi.mock('./panel-close-command', () => ({ PanelCloseCommand: () => null }))

const panel = (id: string, sessionId: string): PanelEntry => ({
  panelId: id,
  node: {
    id,
    type: 'PANEL',
    props: { title: id },
  } as unknown as PanelEntry['node'],
  presentation: 'modal',
  viewState: {},
  session: { formSessionId: sessionId, revision: 0 },
})

const push = (entry: PanelEntry) => {
  act(() => {
    usePanelStore.getState().push(entry)
  })
}

describe('DialogHost — стек панелей', () => {
  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
    mounts.clear()
  })
  afterEach(cleanup)

  // Окно строки «Тарификации» + панель выбора поверх него: панель-родитель
  // обязана пережить открытие и закрытие дочерней, иначе её незаписанные
  // правки обнулятся.
  it('вторая панель открывается ПОВЕРХ первой, не закрывая её', () => {
    render(<DialogHost />)

    push(panel('rowForm', 's1'))
    expect(screen.getByTestId('node-rowForm')).toBeTruthy()

    push(panel('refPicker', 's2'))

    // Обе на экране, родитель НЕ перемонтирован.
    expect(screen.getByTestId('node-rowForm')).toBeTruthy()
    expect(screen.getByTestId('node-refPicker')).toBeTruthy()
    expect(mounts.get('rowForm')).toBe(1)
  })

  it('закрытие дочерней возвращает в родителя, а не перемонтирует его', () => {
    render(<DialogHost />)
    push(panel('rowForm', 's1'))
    push(panel('refPicker', 's2'))

    act(() => {
      usePanelStore.getState().remove('refPicker')
    })

    expect(screen.queryByTestId('node-refPicker')).toBeNull()
    expect(screen.getByTestId('node-rowForm')).toBeTruthy()
    expect(mounts.get('rowForm')).toBe(1)
  })

  // Дефект со стенда 19.08.2026: «нажимаю „Показать все“ — ничего не
  // происходит». Окно строки — полноэкранная page-панель (у MUI Dialog слой
  // 1300), панель выбора — drawer (слой 1200), поэтому она открывалась ПОД
  // окном строки. Слой обязан определяться позицией в стеке, а не типом
  // компонента.
  it('панель выбора (drawer) ложится ПОВЕРХ полноэкранной панели', () => {
    render(<DialogHost />)

    push({ ...panel('rowForm', 's1'), presentation: 'page' })
    push({ ...panel('choice', 's2'), presentation: 'drawer' })

    const zIndex = (id: string) =>
      Number(
        screen
          .getByTestId(`node-${id}`)
          .closest('[style*="z-index"]')
          ?.getAttribute('style')
          ?.match(/z-index:\s*(\d+)/)?.[1]
      )

    expect(zIndex('choice')).toBeGreaterThan(zIndex('rowForm'))
  })

  it('обновление ревизии родителя не перемонтирует его', () => {
    render(<DialogHost />)
    push(panel('rowForm', 's1'))

    act(() => {
      usePanelStore.getState().updateSession('rowForm', 7)
    })

    expect(mounts.get('rowForm')).toBe(1)
  })
})

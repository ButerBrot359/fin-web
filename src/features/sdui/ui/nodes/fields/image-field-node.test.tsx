import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { ImageFieldNode } from './image-field-node'

const dispatchMock = vi.fn()
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../../../api/image-field-api', () => ({
  fetchImageFieldBlob: vi.fn(() => Promise.reject(new Error('no photo'))),
  uploadImageFieldFile: vi.fn(),
}))

const renderNode = (node: ViewNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ImageFieldNode node={node} />
    </QueryClientProvider>
  )

const editableNode = (over: Record<string, unknown> = {}): ViewNode => ({
  id: 'page.Polzovateli.field.fotografiya',
  type: 'IMAGE_FIELD',
  props: {
    sourceUrl: null,
    uploadUrl: '/api/polzovateli/1/photo',
    clearCommand: 'etalon1c:ochistitFotografiyu',
    maxSizeBytes: 2097152,
    accept: 'image/png,image/jpeg',
    visible: true,
    enabled: true,
    ...over,
  },
})

afterEach(() => {
  cleanup()
  dispatchMock.mockClear()
})

describe('ImageFieldNode (SCRUM-308 v3 §2)', () => {
  it('sourceUrl: null → серый силуэт, не пустота (§2.3)', () => {
    const { container } = renderNode(editableNode())
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('редактируемый узел открывает меню действий по клику', () => {
    renderNode(editableNode())
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('sdui.imageField.choosePhoto')).toBeTruthy()
    expect(screen.getByText('sdui.imageField.clearPhoto')).toBeTruthy()
  })

  it('новая карточка (uploadUrl: null) — «Выбрать…» погашен, загружать некуда', () => {
    renderNode(editableNode({ uploadUrl: null }))
    fireEvent.click(screen.getByRole('button'))
    const choose = screen.getByText('sdui.imageField.choosePhoto').closest('li')
    expect(choose?.getAttribute('aria-disabled')).toBe('true')
  })

  it('без фото «Очистить» погашен; очистка при фото шлёт clearCommand (§2.5)', () => {
    renderNode(editableNode())
    fireEvent.click(screen.getByRole('button'))
    const clear = screen.getByText('sdui.imageField.clearPhoto').closest('li')
    expect(clear?.getAttribute('aria-disabled')).toBe('true')
    cleanup()

    renderNode(editableNode({ sourceUrl: '/api/polzovateli/1/photo?v=1' }))
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('sdui.imageField.clearPhoto'))
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'etalon1c:ochistitFotografiyu',
    })
  })

  it('миниатюра без ключей действий (§2.2) — read-only, меню нет', () => {
    renderNode({
      id: 'list.Polzovateli.panel.kontakty.field.fotografiya',
      type: 'IMAGE_FIELD',
      props: { sourceUrl: null, visible: true, enabled: true },
    })
    expect(screen.queryByRole('button')).toBeNull()
  })
})

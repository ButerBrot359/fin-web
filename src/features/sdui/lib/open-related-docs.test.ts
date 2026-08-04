import { beforeEach, describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewResponse } from '../types/view'
import {
  fetchRelatedDocsView,
  postRelatedDocsAction,
} from '../api/related-docs-api'
import { openDialogAsPanel } from './open-dialog-panel'
import { useConfirmStore } from './stores/confirm-store'
import { useRelatedDocsStore } from './stores/related-docs-store'
import { handleRelatedCommand } from './open-related-docs'

vi.mock('../api/related-docs-api', () => ({
  fetchRelatedDocsView: vi.fn(),
  postRelatedDocsAction: vi.fn(),
}))
vi.mock('./open-dialog-panel', () => ({ openDialogAsPanel: vi.fn() }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
vi.mock('i18next', () => ({ default: { t: (k: string) => k } }))

const mockFetch = vi.mocked(fetchRelatedDocsView)
const mockPost = vi.mocked(postRelatedDocsAction)

const response = (effects: ViewResponse['effects']): ViewResponse => ({
  formSessionId: '',
  revision: 0,
  effects,
})

const ctxProps = { anchorId: 'a1', rootId: 'root1' }

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('handleRelatedCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useRelatedDocsStore.getState().reset()
    mockFetch.mockResolvedValue(response([]))
    mockPost.mockResolvedValue(response([]))
  })

  it('чужая команда — false, ничего не зовёт', () => {
    expect(handleRelatedCommand('table.add:X', ctxProps)).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('related.refresh — GET с rootId и anchorId', async () => {
    expect(handleRelatedCommand('related.refresh', ctxProps)).toBe(true)
    await flush()
    expect(mockFetch).toHaveBeenCalledWith('root1', 'a1')
  })

  it('related.setRoot без выделения — notify, запроса нет', async () => {
    expect(handleRelatedCommand('related.setRoot', ctxProps)).toBe(true)
    await flush()
    expect(showToast).toHaveBeenCalledWith(
      'info',
      'sdui.relatedDocs.noSelection'
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('related.setRoot с выделением — GET от выделенной строки', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    handleRelatedCommand('related.setRoot', ctxProps)
    await flush()
    expect(mockFetch).toHaveBeenCalledWith('r5', 'a1')
  })

  it('related.post с выделением — POST post, эффекты играются', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    const dialogEffect = {
      type: 'openDialog' as const,
      node: { id: 'dialog.related.a1', type: 'PAGE' as const },
    }
    mockPost.mockResolvedValue(
      response([
        { type: 'notify' as const, level: 'success', message: 'Проведён' },
        dialogEffect,
      ])
    )
    handleRelatedCommand('related.post', ctxProps)
    await flush()
    expect(mockPost).toHaveBeenCalledWith('post', 'r5', 'root1', 'a1')
    expect(showToast).toHaveBeenCalledWith('success', 'Проведён')
    expect(openDialogAsPanel).toHaveBeenCalledWith(dialogEffect)
  })

  it('toggleDeletionMark: confirm с серверным текстом, отказ — без POST', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    handleRelatedCommand('related.toggleDeletionMark', {
      ...ctxProps,
      confirmMessageSet: 'Пометить?',
      confirmMessageUnset: 'Снять?',
    })
    await flush()
    expect(useConfirmStore.getState().open).toBe(true)
    expect(useConfirmStore.getState().message).toBe('Пометить?')
    useConfirmStore.getState().answer(false)
    await flush()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('toggleDeletionMark: у помеченной строки текст Unset, согласие — POST', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: true })
    handleRelatedCommand('related.toggleDeletionMark', {
      ...ctxProps,
      confirmMessageSet: 'Пометить?',
      confirmMessageUnset: 'Снять?',
    })
    await flush()
    expect(useConfirmStore.getState().message).toBe('Снять?')
    useConfirmStore.getState().answer(true)
    await flush()
    expect(mockPost).toHaveBeenCalledWith(
      'toggle-deletion-mark',
      'r5',
      'root1',
      'a1'
    )
  })

  it('related.refresh: reject у fetchRelatedDocsView — тост об ошибке, без unhandled rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    expect(handleRelatedCommand('related.refresh', ctxProps)).toBe(true)
    await flush()
    expect(showToast).toHaveBeenCalledWith(
      'error',
      'sdui.relatedDocs.requestError'
    )
  })

  it('related.setRoot: reject у fetchRelatedDocsView — тост об ошибке', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    mockFetch.mockRejectedValueOnce(new Error('504'))
    handleRelatedCommand('related.setRoot', ctxProps)
    await flush()
    expect(showToast).toHaveBeenCalledWith(
      'error',
      'sdui.relatedDocs.requestError'
    )
  })

  it('related.post: reject у postRelatedDocsAction — тост об ошибке', async () => {
    useRelatedDocsStore
      .getState()
      .select('a1', { rowId: 'r5', isDeletionMarked: false })
    mockPost.mockRejectedValueOnce(new Error('504'))
    handleRelatedCommand('related.post', ctxProps)
    await flush()
    expect(showToast).toHaveBeenCalledWith(
      'error',
      'sdui.relatedDocs.requestError'
    )
  })
})

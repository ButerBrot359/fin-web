import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  supportsDirectoryPicker,
  pickDirectory,
  writeBlobToDirectory,
} from './save-to-directory'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('supportsDirectoryPicker', () => {
  it('true когда window.showDirectoryPicker — функция', () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    expect(supportsDirectoryPicker()).toBe(true)
  })
  it('false когда API отсутствует', () => {
    vi.stubGlobal('showDirectoryPicker', undefined)
    expect(supportsDirectoryPicker()).toBe(false)
  })
})

describe('pickDirectory', () => {
  it('возвращает handle из showDirectoryPicker', async () => {
    const dir = { getFileHandle: vi.fn() }
    vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(dir))
    await expect(pickDirectory()).resolves.toBe(dir)
  })
  it('AbortError (отмена) → null', async () => {
    vi.stubGlobal(
      'showDirectoryPicker',
      vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    )
    await expect(pickDirectory()).resolves.toBeNull()
  })
  it('нет API → null', async () => {
    vi.stubGlobal('showDirectoryPicker', undefined)
    await expect(pickDirectory()).resolves.toBeNull()
  })
})

describe('writeBlobToDirectory', () => {
  it('создаёт файл и пишет blob под именем', async () => {
    const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }
    const fileHandle = { createWritable: vi.fn().mockResolvedValue(writable) }
    const dir = { getFileHandle: vi.fn().mockResolvedValue(fileHandle) }
    const blob = new Blob(['<xml/>'], { type: 'application/xml' })

    await writeBlobToDirectory(dir as never, 'ЗаявкаГПС.xml', blob)

    expect(dir.getFileHandle).toHaveBeenCalledWith('ЗаявкаГПС.xml', { create: true })
    expect(writable.write).toHaveBeenCalledWith(blob)
    expect(writable.close).toHaveBeenCalled()
  })
})

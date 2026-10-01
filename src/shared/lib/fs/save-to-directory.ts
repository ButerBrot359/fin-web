// Минимальное подмножество File System Access API (в TS 5.9 стандартно не
// типизировано целиком; локальные типы + каст window через unknown — без
// глобальной аугментации, чтобы не конфликтовать с lib.dom).
interface FsWritable {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FsFileHandle {
  createWritable(): Promise<FsWritable>
}
export interface FsDirectoryHandle {
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FsFileHandle>
}
type ShowDirectoryPicker = (options?: {
  mode?: 'read' | 'readwrite'
}) => Promise<FsDirectoryHandle>

const getPicker = (): ShowDirectoryPicker | undefined =>
  (window as unknown as { showDirectoryPicker?: ShowDirectoryPicker })
    .showDirectoryPicker

/** Chromium поддерживает File System Access (Chrome/Edge); FF/Safari — нет. */
export const supportsDirectoryPicker = (): boolean =>
  typeof getPicker() === 'function'

/**
 * Открывает системный диалог выбора папки (только Chromium). Возвращает handle
 * или null при отмене пользователем. ВЫЗЫВАТЬ синхронно в обработчике клика —
 * API требует transient user activation.
 */
export async function pickDirectory(): Promise<FsDirectoryHandle | null> {
  const show = getPicker()
  if (!show) return null
  try {
    return await show({ mode: 'readwrite' })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    throw e
  }
}

/** Пишет blob в выбранную папку под именем fileName (перезапись, если есть). */
export async function writeBlobToDirectory(
  dir: FsDirectoryHandle,
  fileName: string,
  blob: Blob
): Promise<void> {
  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
}

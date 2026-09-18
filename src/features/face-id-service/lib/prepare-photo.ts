const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface PreparedFaceIdPhoto {
  image: string
  preview: string
}

export async function prepareFaceIdPhoto(
  file: File
): Promise<PreparedFaceIdPhoto> {
  if (
    !TYPES.has(file.type) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new Error('Unsupported image')
  }
  const bitmap = await createImageBitmap(file)
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error('Image too large')
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image conversion unavailable')
    // Белый фон — часть нормализации прозрачных фотографий, а не цвет интерфейса.
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.9, 0.8, 0.65]) {
      const preview = canvas.toDataURL('image/jpeg', quality)
      const image = preview.split(',')[1]
      if (
        preview.startsWith('data:image/jpeg;base64,') &&
        image &&
        atob(image).length <= 350_000
      )
        return { image, preview }
    }
    throw new Error('Image too large')
  } finally {
    bitmap.close()
  }
}

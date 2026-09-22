import { parseContentDispositionFilename } from '@/shared/lib/http/parse-content-disposition'

export function saveSwiftFile(
  blob: Blob,
  contentDisposition: string | undefined,
  fallbackName: string
): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download =
    parseContentDispositionFilename(contentDisposition) || fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 60_000)
}

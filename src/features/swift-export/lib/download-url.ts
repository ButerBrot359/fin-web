import type { SwiftEncoding, SwiftFormat } from '../types/swift-export'

export function swiftExportDownloadUrl(
  typeCode: string,
  id: number,
  format: SwiftFormat,
  encoding: SwiftEncoding
): string {
  const base = import.meta.env.VITE_API_BASE_URL
  const query = `format=${format}&encoding=${encoding}`
  return `${base}/api/document-entries/${typeCode}/${String(id)}/swift-export?${query}`
}

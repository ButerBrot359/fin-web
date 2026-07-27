/**
 * URL GET-эндпоинта одиночного документа для нативной навигации браузера
 * (SCRUM-265 v7 §2.1). Имя файла берётся браузером из Content-Disposition —
 * JS его НЕ формирует, поэтому blob+<a download> UUID-бага нет по построению.
 */
export function treasuryExportDownloadUrl(typeCode: string, id: number): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  return `${base}/api/document-entries/${typeCode}/${id}/treasury-export`
}

interface DocumentPathParams {
  pageCode: string
  moduleCode: string
}

export const getDocumentListPath = ({
  pageCode,
  moduleCode,
}: DocumentPathParams): string => `/modules/${pageCode}/document/${moduleCode}`

export const getDocumentEntryPath = (
  params: DocumentPathParams,
  entryId: number
): string => `${getDocumentListPath(params)}/${String(entryId)}`

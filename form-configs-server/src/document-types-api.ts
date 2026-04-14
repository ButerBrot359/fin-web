export interface Attribute {
  code: string
  nameRu: string
  dataType: string
  domainKind: string | null
  isRequired: boolean
  sortOrder: number
}

interface DocumentTypeResponse {
  data: {
    code: string
    nameRu: string
    nameKz: string
    attributes: {
      code: string
      nameRu: string
      dataType: string
      domainKind: string | null
      isRequired: boolean
      sortOrder: number
      showInForm: boolean
    }[]
  }
  success: boolean
}

export async function fetchDocumentAttributes(
  docCode: string
): Promise<{ title: string; attributes: Attribute[] }> {
  const baseUrl = process.env.DOCUMENT_TYPES_API_BASE_URL
  if (!baseUrl) {
    throw new Error('DOCUMENT_TYPES_API_BASE_URL is not configured')
  }

  const url = `${baseUrl}/api/document-types/${docCode}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch document type "${docCode}": ${String(response.status)} ${response.statusText}`
    )
  }

  const json = (await response.json()) as DocumentTypeResponse

  const attributes = json.data.attributes
    .filter((attr) => attr.showInForm)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((attr) => ({
      code: attr.code,
      nameRu: attr.nameRu,
      dataType: attr.dataType,
      domainKind: attr.domainKind,
      isRequired: attr.isRequired,
      sortOrder: attr.sortOrder,
    }))

  if (attributes.length === 0) {
    throw new Error(`Document type "${docCode}" has no form attributes`)
  }

  return { title: json.data.nameRu, attributes }
}

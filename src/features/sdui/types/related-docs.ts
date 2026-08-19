// Контракт строки дерева связанных документов (SCRUM-301, бэк-спека §2).
// Дерево приходит ПЛОСКИМ списком: порядок строк = порядок отрисовки,
// фронт не сортирует. Union-литерал _direction — чтобы забытая ветка в
// рендере была ошибкой компиляции, а не тихим дефолтом.
export type RelatedTreeDirection = 'UP' | 'SELF' | 'DOWN'

export interface RelatedTreeEntityRef {
  domain: string
  id: number | string
  presentation?: string
  typeCode: string
}

export interface RelatedTreeRow {
  rowId: string
  _level: number
  _direction: RelatedTreeDirection
  _parentRowId: string | null
  _isCurrent: boolean
  _presentation: string
  // Маркер обрыва ветки, а не документ: не выделяется и не проваливается
  _isTruncated?: boolean
  _isPosted: boolean
  _isDeletionMarked: boolean
  _status?: string
  // SCRUM-362 B-6: непустой на каждой строке-документе; null — только на
  // маркере недоступности/обрыва (_isTruncated: true), фронт маршрут не строит.
  _route: string | null
  _type?: { entityRef?: RelatedTreeEntityRef } | null
}

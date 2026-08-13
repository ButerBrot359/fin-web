// Навигация по уровням иерархического справочника в LIST-узле панели выбора.
// Бэк отдаёт уровень тем же `/paged`: без `parent` — корень (папки + записи
// корня), с `?parent={id}` — прямые потомки папки. Признак папки в строке один —
// `isGroup`; отдельного «типа узла» бэк не присылает.
import type { ListRow, ListSource } from './list-column-defs'

/**
 * `parent` поддержан только доменом DICTIONARY (`DomainServiceRegistry.getEntriesPaged`),
 * поэтому на остальных источниках навигация по уровням выключена: у документов и плана
 * счетов `isGroup` в строке может встретиться, но проваливаться там некуда.
 */
const HIERARCHY_SOURCE = /\/universaldomain-entries\/DICTIONARY\/[^/]+\/paged$/

/**
 * Панель выбирает ПАПКУ (`referenceSelectionMode=GROUP`): бэк отдаёт плоский список
 * всех групп и игнорирует `parent`. Папки здесь выбираются строкой, внутрь
 * проваливаться не нужно.
 */
export const isGroupsOnlySource = (source: ListSource | undefined): boolean =>
  source?.params?.groupsOnly === 'true'

/** Источник, у которого уровни вообще имеют смысл. */
export const supportsHierarchy = (source: ListSource | undefined): boolean =>
  !!source?.url &&
  HIERARCHY_SOURCE.test(source.url) &&
  !isGroupsOnlySource(source)

/** Строка-папка: провал внутрь вместо выбора. */
export const isGroupRow = (row: ListRow): boolean => row.isGroup === true

/**
 * Путь папок от корня к записи, стоящей в поле (`LIST.props.selectedPath`) — панель
 * открывается сразу внутри нужной папки. Считает сервер: подъём по предкам это цепочка
 * запросов с проверкой каждого звена, на клиенте её быть не должно.
 *
 * Форма пропа не гарантирована типами — берём только узлы с числовым `id`.
 */
export const parseSelectedPath = (
  raw: unknown
): { id: number; label: string }[] => {
  if (!Array.isArray(raw)) return []
  const path: { id: number; label: string }[] = []
  for (const node of raw) {
    if (typeof node !== 'object' || node === null) continue
    const { id, presentation } = node as {
      id?: unknown
      presentation?: unknown
    }
    if (typeof id !== 'number') continue
    path.push({
      id,
      label:
        typeof presentation === 'string' && presentation.trim()
          ? presentation
          : String(id),
    })
  }
  return path
}

/** Подпись папки в хлебных крошках. */
export const resolveRowLabel = (row: ListRow): string => {
  for (const key of ['presentation', 'displayName', 'nameRu', 'code']) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return String(row.id)
}

/**
 * Параметры запроса уровня.
 *
 * `flatWithGroups` сервер кладёт в `props.source.params`, пока панель плоская: он
 * возвращает весь справочник вперемешку (замер стенда — 110 строк вместо 15
 * корневых) и обессмысливает уровни, поэтому дальше не уходит. `parent` из
 * серверных параметров тоже вырезаем — им владеет навигация.
 *
 * `parentId === undefined` — корневой уровень (запрос без `parent`).
 */
export const buildLevelParams = (
  params: Record<string, string> | undefined,
  parentId: number | undefined
): Record<string, string> => {
  const scoped = Object.fromEntries(
    Object.entries(params ?? {}).filter(
      ([key]) => key !== 'flatWithGroups' && key !== 'parent'
    )
  )
  return parentId != null ? { ...scoped, parent: String(parentId) } : scoped
}

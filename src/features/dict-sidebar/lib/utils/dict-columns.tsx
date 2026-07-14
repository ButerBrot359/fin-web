import type { ReactNode } from 'react'
import { Typography } from '@mui/material'
import type { TFunction } from 'i18next'

import type { DocumentAttribute } from '@/entities/document-type'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { DictColumnDto, DictEntry } from '../../api/dict-sidebar-api'

/**
 * Колонка диалога справочника — общая модель для плоской таблицы и дерева.
 * `render` возвращает содержимое ячейки по записи, `id` совпадает с кодом
 * атрибута (для серверной сортировки) либо `nameRu` для колонки представления.
 */
export interface DictColumn {
  id: string
  title: string
  sortable: boolean
  render: (entry: DictEntry) => ReactNode
}

const Text = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {children}
  </Typography>
)

/**
 * Строит колонки из видимых атрибутов типа (`showInList`, порядок
 * `tableSortOrder`) плюс колонку представления (`displayName`). Логика значений
 * повторяет прежний рендер плоской таблицы, чтобы дерево и таблица совпадали.
 */
export const buildDictColumns = (
  attributes: DocumentAttribute[],
  typeCode: string,
  language: string,
  t: TFunction
): DictColumn[] => {
  const visible = [...attributes]
    .filter((attr) => attr.showInList)
    .sort((a, b) => a.tableSortOrder - b.tableSortOrder)

  const attributeColumns: DictColumn[] = visible.map((attr) => ({
    id: attr.code,
    title: getLocalizedName(attr, language),
    sortable: true,
    render: (entry) => {
      const value =
        attr.code === 'Kod' &&
        typeCode === 'EdiniyPlanSchetovGosUchrezhdeniya'
          ? (entry.code || entry.attributes?.[attr.code])
          : entry.attributes?.[attr.code]

      if (
        (attr.dataType === 'DATE' || attr.dataType === 'DATETIME') &&
        typeof value === 'string'
      ) {
        const fmt =
          attr.dataType === 'DATE' ? 'dd.MM.yyyy' : 'dd.MM.yyyy HH:mm:ss'
        return <Text>{formatDate(value, fmt)}</Text>
      }

      const display =
        typeof value === 'object' && value !== null
          ? ((value as Record<string, unknown>).name ??
            (value as Record<string, unknown>).nameRu)
          : value
      return (
        <Text>
          {typeof display === 'string' || typeof display === 'number'
            ? display
            : ''}
        </Text>
      )
    },
  }))

  const nameColumn: DictColumn = {
    id: 'nameRu',
    title: t('documentTable.link'),
    sortable: true,
    render: (entry) => (
      <Text>{entry.displayName ?? getLocalizedName(entry, language)}</Text>
    ),
  }

  return [...attributeColumns, nameColumn]
}

/** Значение ячейки по ключу колонки с бэка: топ-поля записи ∥ её `attributes`. */
const renderEntryField = (
  entry: DictEntry,
  key: string,
  asCode: boolean
): string | number => {
  if (asCode) return entry.code ?? ''
  switch (key) {
    case 'code':
    case 'Kod':
      return entry.code ?? ''
    // Представление узла (с учётом displayAsCode) уже приходит в displayName.
    case 'nameRu':
    case 'displayName':
      return entry.displayName ?? entry.nameRu ?? ''
    case 'nameKz':
      return entry.nameKz ?? ''
    default: {
      const value = entry.attributes?.[key]
      const display =
        typeof value === 'object' && value !== null
          ? ((value as Record<string, unknown>).name ??
            (value as Record<string, unknown>).nameRu)
          : value
      return typeof display === 'string' || typeof display === 'number'
        ? display
        : ''
    }
  }
}

/**
 * Переводит колонки с бэка (`/api/dictionaries/entries/{typeCode}/columns`) в
 * общую модель. Контракт не зафиксирован, поэтому ключ/заголовок берём из
 * первого доступного синонима; строки без ключа отбрасываем. Пустой результат
 * → вызывающий откатывается на `buildDictColumns` (атрибуты типа).
 */
export const mapDictColumns = (
  dtos: DictColumnDto[],
  language: string
): DictColumn[] =>
  dtos
    .map((dto): DictColumn | null => {
      const key = dto.key ?? dto.field ?? dto.attributeCode ?? dto.code
      if (!key) return null
      const title =
        (language === 'kz'
          ? (dto.titleKz ?? dto.nameKz ?? dto.titleRu ?? dto.nameRu)
          : (dto.titleRu ?? dto.nameRu ?? dto.titleKz ?? dto.nameKz)) ??
        dto.title ??
        key
      const asCode = dto.displayAsCode === true
      return {
        id: key,
        title,
        sortable: dto.sortable ?? true,
        render: (entry) => <Text>{renderEntryField(entry, key, asCode)}</Text>,
      }
    })
    .filter((col): col is DictColumn => col !== null)

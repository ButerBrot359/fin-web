import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import { getDocumentType } from '@/entities/document-type'
import type { DocumentAttribute } from '@/entities/document-type'
import {
  useDebouncedValue,
  useTableFilterStore,
  useTableFilters,
} from '@/features/table-filter'
import { apiService } from '@/shared/api/api'
import {
  getUniversalSearchUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import type { SelectOption } from '@/shared/types/select-option'
import { AutocompleteInput } from '@/shared/ui/inputs'

import { TABEL_CRITERIA, TABEL_ROW_TYPE_CODE } from '../lib/consts/tabel-list'

interface DictEntryDto {
  id: number
  code: string
  displayName?: string
  nameRu?: string
  nameKz?: string
}

interface DictSearchResponse {
  data: { content: DictEntryDto[] }
}

interface CriterionContract {
  field: string
  label: string
  url: string | null
}

interface CriterionControlProps {
  contract: CriterionContract
  value: SelectOption | null
  onChange: (value: SelectOption | null) => void
}

const CriterionControl = ({
  contract,
  value,
  onChange,
}: CriterionControlProps) => {
  const { i18n } = useTranslation()
  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const debounced = useDebouncedValue(inputValue, 300)

  // Тот же серверный поиск, что у DictionaryControl фильтров (SCRUM-360):
  // клиент не строит собственного сопоставления id → name (§3.1)
  const { data: options = [], isFetching } = useQuery<
    AxiosResponse<DictSearchResponse>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['tabel-criterion-search', contract.url, debounced],
    queryFn: () =>
      apiService.get<DictSearchResponse>({
        url: contract.url ?? '',
        params: { q: debounced, size: 30 },
      }),
    enabled: !!contract.url && opened,
    select: (response) =>
      response.data.data.content.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            (entry.displayName ?? getLocalizedName(entry, i18n.language)) ||
            entry.code,
        })
      ),
  })

  return (
    <div className="w-64">
      <AutocompleteInput
        value={value}
        options={options}
        loading={isFetching}
        label={contract.label}
        disabled={!contract.url}
        onOpen={() => {
          setOpened(true)
        }}
        onInputChange={(_e, v, reason) => {
          if (reason !== 'reset') setInputValue(v)
        }}
        onChange={(opt) => {
          // Пикер передаёт id, отображает presentation (§3.1); в store уходит
          // {id, code, label}, serializeFilterForApi разворачивает до голого id
          onChange(
            opt ? { id: opt.id, code: opt.code, label: opt.label } : null
          )
        }}
      />
    </div>
  )
}

interface TabelListCriteriaProps {
  tableId: string
  attributes: DocumentAttribute[]
}

/**
 * Критерии списка Табеля (spec v2 §3.1): Организация и Подразделение — из
 * metadata шапки Tabel; Сотрудник — из metadata строки ТЧ. Значения живут в
 * общем filter-store списка: сортировка, пагинация, поиск и export работают
 * с одним list-state, а «Сотрудник» сервер ищет по строкам ТЧ через EXISTS.
 */
export const TabelListCriteria = ({
  tableId,
  attributes,
}: TabelListCriteriaProps) => {
  const { i18n } = useTranslation()
  const filters = useTableFilters(tableId)
  const setFilter = useTableFilterStore((s) => s.setFilter)

  // Metadata строки ТЧ — для критерия «Сотрудник» (allowedTypes-resolver, не
  // эвристика по имени поля). Ошибка загрузки не роняет список: контрол
  // остаётся disabled до починки metadata на бэке (backend follow-up §3.1).
  const { data: rowType } = useQuery({
    queryKey: ['document-types', TABEL_ROW_TYPE_CODE],
    queryFn: () => getDocumentType(TABEL_ROW_TYPE_CODE),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const findAttr = (
    list: DocumentAttribute[] | undefined,
    code: string
  ): DocumentAttribute | undefined => list?.find((a) => a.code === code)

  const contracts: CriterionContract[] = TABEL_CRITERIA.map(
    ({ field, source }) => {
      const attr =
        source === 'header'
          ? findAttr(attributes, field)
          : findAttr(rowType?.attributes, field)
      const resolved = attr ? resolveAttributeDomain(attr) : null
      return {
        field,
        label: attr ? getLocalizedName(attr, i18n.language) : field,
        url: resolved
          ? getUniversalSearchUrl(resolved.domain, resolved.typeCode)
          : null,
      }
    }
  )

  const valueOf = (field: string): SelectOption | null => {
    const current = filters.find((f) => f.field === field)?.value
    return current && typeof current === 'object' && 'id' in current
      ? (current as SelectOption)
      : null
  }

  return (
    <div className="flex items-center gap-3">
      {contracts.map((contract) => (
        <CriterionControl
          key={contract.field}
          contract={contract}
          value={valueOf(contract.field)}
          onChange={(opt) => {
            // Не более одного условия на поле, только op:eq (§2.1) — upsert
            // в store по field это гарантирует; смена критерия перезапрашивает
            // сервер с первой страницы (queryKey инфинит-запроса включает filter)
            setFilter(
              tableId,
              contract.field,
              opt ? { field: contract.field, op: 'eq', value: opt } : null
            )
          }}
        />
      ))}
    </div>
  )
}

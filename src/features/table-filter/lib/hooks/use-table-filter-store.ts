import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import type { FilterCondition, FilterRequest } from '@/shared/lib/eav'

interface TableFilterState {
  filters: FilterCondition[]
}

interface TableFilterStore {
  byTable: Record<string, TableFilterState | undefined>
  setFilter: (tableId: string, field: string, condition: FilterCondition | null) => void
  setAll: (tableId: string, filters: FilterCondition[]) => void
  removeFilter: (tableId: string, field: string) => void
  clearAll: (tableId: string) => void
}

const upsertCondition = (
  list: FilterCondition[],
  field: string,
  next: FilterCondition | null
): FilterCondition[] => {
  const without = list.filter((c) => c.field !== field)
  if (!next) return without
  return [...without, next]
}

export const useTableFilterStore = create<TableFilterStore>((set) => ({
  byTable: {},

  setFilter: (tableId, field, condition) => {
    set((state) => {
      const current = state.byTable[tableId]?.filters ?? []
      const filters = upsertCondition(current, field, condition)
      return {
        byTable: { ...state.byTable, [tableId]: { filters } },
      }
    })
  },

  setAll: (tableId, filters) => {
    set((state) => ({
      byTable: { ...state.byTable, [tableId]: { filters } },
    }))
  },

  removeFilter: (tableId, field) => {
    set((state) => {
      const current = state.byTable[tableId]?.filters ?? []
      const filters = current.filter((c) => c.field !== field)
      return {
        byTable: { ...state.byTable, [tableId]: { filters } },
      }
    })
  },

  clearAll: (tableId) => {
    set((state) => ({
      byTable: { ...state.byTable, [tableId]: { filters: [] } },
    }))
  },
}))

export const useTableFilters = (tableId: string): FilterCondition[] => {
  const filters = useTableFilterStore(
    useShallow((state) => state.byTable[tableId]?.filters ?? [])
  )
  return filters
}

export const useTableFilterRequest = (tableId: string): FilterRequest => {
  const filters = useTableFilters(tableId)
  return useMemo<FilterRequest>(
    () => ({ filters, logic: 'AND' }),
    [filters]
  )
}

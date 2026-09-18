import { describe, expect, it } from 'vitest'

import type { ViewNode, ViewNodeAction } from '../../types/view'
import { readListActions } from './read-list-actions'

const node = (actions?: ViewNodeAction[]): ViewNode => ({
  id: 'list.panel',
  type: 'LIST',
  actions,
})

const action = (
  trigger: string,
  extra?: Partial<ViewNodeAction>
): ViewNodeAction => ({
  trigger,
  actionId: `id-${trigger}`,
  command: `list.${trigger}`,
  ...extra,
})

describe('readListActions', () => {
  it('узел без actions — все поля undefined (контролы гейтятся fail-closed)', () => {
    const result = readListActions(node())
    expect(result).toEqual({
      selectAction: undefined,
      activateAction: undefined,
      sortCommand: undefined,
      filterCommand: undefined,
      clearFilterCommand: undefined,
      clearAllFiltersCommand: undefined,
      periodCommand: undefined,
      exportCommand: undefined,
    })
  })

  it('полный набор SEARCH-транспорта раскладывается по триггерам', () => {
    const result = readListActions(
      node([
        action('select', { selectionField: 'Kontragent' }),
        action('activate'),
        action('sort'),
        action('filter'),
        action('clearFilter'),
        action('clearAllFilters'),
        action('period'),
        action('export', { command: 'list.exportList:all' }),
      ])
    )
    // select/activate нужны целиком (behavior/selectionField), остальным — только command
    expect(result.selectAction?.selectionField).toBe('Kontragent')
    expect(result.activateAction?.command).toBe('list.activate')
    expect(result.sortCommand).toBe('list.sort')
    expect(result.filterCommand).toBe('list.filter')
    expect(result.clearFilterCommand).toBe('list.clearFilter')
    expect(result.clearAllFiltersCommand).toBe('list.clearAllFilters')
    expect(result.periodCommand).toBe('list.period')
    expect(result.exportCommand).toBe('list.exportList:all')
  })

  it('чужие триггеры игнорируются, действие без command даёт undefined-команду', () => {
    const result = readListActions(
      node([
        action('rowMenu'),
        { trigger: 'sort', actionId: 'id-sort' }, // command не пришёл
      ])
    )
    expect(result.sortCommand).toBeUndefined()
    expect(result.selectAction).toBeUndefined()
  })

  it('при дублях триггера берётся первое действие (поведение actions.find)', () => {
    const result = readListActions(
      node([
        action('period', { command: 'list.period:first' }),
        action('period', { command: 'list.period:second' }),
      ])
    )
    expect(result.periodCommand).toBe('list.period:first')
  })
})

import { useEffect, useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useDebouncedValue } from '@/features/table-filter'

import type { NodeProps } from '../../../../types/view'
import { useBindingValue } from '../../../../lib/sdui-session-context'
import { parseTabelMatrixPayload } from './tabel-matrix-contract'
import {
  dayHeader,
  filterEmployees,
  listIntervalDays,
  withKindPresentations,
} from './tabel-matrix-logic'
import { useTabelMatrixQueue } from './tabel-matrix-queue'
import {
  findSotrudnikContract,
  useTabelMatrixActions,
} from './use-tabel-matrix-actions'
import { TabelMatrixGrid } from './tabel-matrix-grid'
import { TabelMatrixToolbar } from './tabel-matrix-toolbar'
import { TabelPodborDialog } from './tabel-matrix-podbor-dialog'

const DEFAULT_BINDING = 'tabel.matrix'

export const TabelMatrixTable: FC<NodeProps> = ({ node }) => {
  const { t, i18n } = useTranslation()
  const binding = node.binding ?? DEFAULT_BINDING
  const rawValue = useBindingValue(binding)
  // Матрица может быть большой (31 день × сотрудники × виды): парсим payload
  // и производные один раз на серверное обновление, не на каждый рендер.
  const payload = useMemo(() => {
    const parsed = parseTabelMatrixPayload(rawValue)
    return parsed ? withKindPresentations(parsed) : null
  }, [rawValue])
  const queue = useTabelMatrixQueue(node.id, binding)
  const actions = useTabelMatrixActions(payload, queue)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [podborOpen, setPodborOpen] = useState(false)

  const generation = payload?.generation ?? -1

  // Новый payload: убираем expand/collapse исчезнувших сотрудников (§5).
  useEffect(() => {
    if (!payload) return
    const ids = new Set(payload.employees.map((e) => e.employeeNodeId))

    setCollapsed((prev) => new Set([...prev].filter((id) => ids.has(id))))
    // generation в deps: чистим по каждому серверному обновлению
  }, [generation, payload])

  const days = useMemo(
    () => (payload ? listIntervalDays(payload.interval).map(dayHeader) : []),
    // i18n.language: подписи дней недели локализованы
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload, i18n.language]
  )
  const existingRefs = useMemo(
    () => new Set((payload?.employees ?? []).map((e) => e.employeeRef)),
    [payload]
  )

  if (!payload) {
    return (
      <Typography variant="body2" sx={{ p: 2, opacity: 0.6 }}>
        {t('sdui.tabel.payloadError')}
      </Typography>
    )
  }

  const picker = findSotrudnikContract(node)

  return (
    <div className="flex flex-col gap-2">
      <TabelMatrixToolbar
        busy={queue.busy}
        hasActiveEmployee={actions.activeId !== null}
        manualWorkKinds={payload.manualWorkKinds}
        query={query}
        onQueryChange={setQuery}
        onAddEmployee={() => {
          actions.addEmployee(picker)
        }}
        onOpenPodbor={() => {
          setPodborOpen(true)
        }}
        onAddWorkKind={actions.addWorkKind}
        onExpandAll={() => {
          setCollapsed(new Set())
        }}
        onCollapseAll={() => {
          setCollapsed(new Set(payload.employees.map((e) => e.employeeNodeId)))
        }}
      />
      <TabelMatrixGrid
        days={days}
        employees={filterEmployees(payload.employees, debouncedQuery)}
        collapsed={collapsed}
        activeId={actions.activeId}
        busy={queue.busy}
        draftKindsFor={actions.draftKindsFor}
        onToggle={(id) => {
          setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }}
        onSelect={actions.selectEmployee}
        onDeleteEmployee={actions.deleteEmployee}
        onDeleteKind={actions.deleteWorkKind}
        onCommitCell={actions.commitCell}
      />
      {podborOpen &&
        (picker.optionsSource?.url ? (
          <TabelPodborDialog
            url={picker.optionsSource.url}
            params={picker.optionsSource.params ?? {}}
            existingRefs={existingRefs}
            onAdd={(refs) => {
              setPodborOpen(false)
              actions.addEmployees(refs)
            }}
            onClose={() => {
              setPodborOpen(false)
            }}
          />
        ) : (
          <Typography variant="body2" sx={{ p: 1, opacity: 0.6 }}>
            {t('sdui.tabel.pickerUnavailable')}
          </Typography>
        ))}
    </div>
  )
}

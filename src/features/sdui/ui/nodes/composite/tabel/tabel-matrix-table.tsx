import { useEffect, useRef, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { NodeProps, ViewNode } from '../../../../types/view'
import { useBindingValue } from '../../../../lib/sdui-session-context'
import { useConfirmStore } from '../../../../lib/stores/confirm-store'
import { openReferencePicker } from '../../../../lib/reference-picker-gateway'
import {
  parseTabelMatrixPayload,
  type TabelEmployee,
  type TabelManualWorkKind,
  type TabelWorkKind,
} from './tabel-matrix-contract'
import {
  buildReplaceEmployee,
  dayHeader,
  filterEmployees,
  listIntervalDays,
  normalizeCellInput,
} from './tabel-matrix-logic'
import { useTabelMatrixQueue } from './tabel-matrix-queue'
import { TabelMatrixGrid } from './tabel-matrix-grid'
import { TabelMatrixToolbar } from './tabel-matrix-toolbar'
import { TabelPodborDialog } from './tabel-matrix-podbor-dialog'

const DEFAULT_BINDING = 'tabel.matrix'

interface SotrudnikPickerContract {
  domain?: string
  targetTypeCode?: string
  filter?: Record<string, unknown>
  optionsSource?: { url: string; params?: Record<string, string> }
}

/** Контракт пикера — из выданной бэком колонки `…col.sotrudnik` (spec v1 §3). */
function findSotrudnikContract(node: ViewNode): SotrudnikPickerContract {
  const col = (node.children ?? []).find(
    (c) =>
      c.type === 'TABLE_COLUMN' &&
      (c.id.endsWith('.col.sotrudnik') || c.binding === 'Sotrudnik')
  )
  return (col?.props ?? {}) as SotrudnikPickerContract
}

/** Черновые виды времени, привязанные к generation (spec v1 §5): к payload
 * другой generation черновики не применяются. */
interface DraftKinds {
  generation: number
  byEmployee: Record<string, TabelManualWorkKind[]>
}

export const TabelMatrixTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const binding = node.binding ?? DEFAULT_BINDING
  const rawValue = useBindingValue(binding)
  const payload = parseTabelMatrixPayload(rawValue)
  const queue = useTabelMatrixQueue(node.id, binding)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<DraftKinds>({
    generation: -1,
    byEmployee: {},
  })
  const [podborOpen, setPodborOpen] = useState(false)

  const generation = payload?.generation ?? -1

  // Новый payload: чистим ссылки на исчезнувших сотрудников; черновики,
  // уже сохранённые сервером (вид появился в payload), убираем из drafts.
  const prevGenerationRef = useRef(generation)
  useEffect(() => {
    if (prevGenerationRef.current === generation || !payload) return
    prevGenerationRef.current = generation
    const ids = new Set(payload.employees.map((e) => e.employeeNodeId))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- реакция на смену серверной generation
    setCollapsed((prev) => new Set([...prev].filter((id) => ids.has(id))))
    setActiveId((prev) => (prev && ids.has(prev) ? prev : null))
    setDrafts((prev) => {
      const next: Record<string, TabelManualWorkKind[]> = {}
      for (const [empId, kinds] of Object.entries(prev.byEmployee)) {
        const employee = payload.employees.find(
          (e) => e.employeeNodeId === empId
        )
        if (!employee) continue
        const saved = new Set(employee.workKinds.map((k) => k.workTimeKindRef))
        const rest = kinds.filter((k) => !saved.has(k.workTimeKindRef))
        if (rest.length > 0) next[empId] = rest
      }
      return { generation, byEmployee: next }
    })
  }, [generation, payload])

  if (!payload) {
    return (
      <Typography variant="body2" sx={{ p: 2, opacity: 0.6 }}>
        {t('sdui.tabel.payloadError')}
      </Typography>
    )
  }

  const days = listIntervalDays(payload.interval).map(dayHeader)
  const existingRefs = new Set(payload.employees.map((e) => e.employeeRef))
  const picker = findSotrudnikContract(node)

  const draftKindsFor = (employeeNodeId: string): TabelManualWorkKind[] =>
    drafts.generation === generation
      ? (drafts.byEmployee[employeeNodeId] ?? [])
      : []

  const selectEmployee = (employee: TabelEmployee) => {
    if (activeId === employee.employeeNodeId) return
    setActiveId(employee.employeeNodeId)
    // SELECT_EMPLOYEE связывает строку UI с server-side active row (§4) —
    // обязательна перед «Перезаполнить текущего сотрудника»
    void queue.enqueue((p) =>
      p.employees.some((e) => e.employeeNodeId === employee.employeeNodeId)
        ? { type: 'SELECT_EMPLOYEE', employeeRef: employee.employeeRef }
        : null
    )
  }

  const commitCell =
    (employeeNodeId: string, workTimeKindRef: number) =>
    (date: string, raw: string): boolean => {
      const input = normalizeCellInput(raw)
      if (!input.ok) {
        showToast('warning', t('sdui.tabel.invalidHours'))
        return false
      }
      void queue.enqueue((p) =>
        buildReplaceEmployee(
          p,
          employeeNodeId,
          { workTimeKindRef, date, value: input.value },
          draftKindsFor(employeeNodeId).map((k) => k.workTimeKindRef)
        )
      )
      return true
    }

  const addEmployee = () => {
    if (!picker.domain || !picker.targetTypeCode) {
      showToast('warning', t('sdui.tabel.pickerUnavailable'))
      return
    }
    const searchParams = picker.filter
      ? Object.fromEntries(
          Object.entries(picker.filter).map(([k, v]) => [k, String(v)])
        )
      : undefined
    openReferencePicker({
      mode: 'list',
      domain: picker.domain,
      typeCode: picker.targetTypeCode,
      searchParams,
      onSelect: (option) => {
        if (!option) return
        const ref = Number(option.id)
        if (existingRefs.has(ref)) {
          showToast('info', t('sdui.tabel.alreadyAdded'))
          return
        }
        void queue.enqueue(() => ({ type: 'ADD_EMPLOYEE', employeeRef: ref }))
      },
    })
  }

  const addWorkKind = (kind: TabelManualWorkKind) => {
    if (!activeId) return
    const employee = payload.employees.find(
      (e) => e.employeeNodeId === activeId
    )
    if (!employee) return
    const exists =
      employee.workKinds.some(
        (k) => k.workTimeKindRef === kind.workTimeKindRef
      ) ||
      draftKindsFor(activeId).some(
        (k) => k.workTimeKindRef === kind.workTimeKindRef
      )
    if (exists) {
      showToast('info', t('sdui.tabel.kindAlreadyAdded'))
      return
    }
    setDrafts((prev) => ({
      generation,
      byEmployee: {
        ...(prev.generation === generation ? prev.byEmployee : {}),
        [activeId]: [...draftKindsFor(activeId), kind],
      },
    }))
  }

  const deleteEmployee = (employee: TabelEmployee) => {
    const name = employee.employeePresentation ?? String(employee.employeeRef)
    void useConfirmStore
      .getState()
      .ask(t('sdui.tabel.deleteEmployeeConfirm', { name }))
      .then((ok) => {
        if (!ok) return
        void queue.enqueue((p) =>
          p.employees.some((e) => e.employeeNodeId === employee.employeeNodeId)
            ? {
                type: 'DELETE_EMPLOYEE',
                employeeNodeId: employee.employeeNodeId,
                employeeRef: employee.employeeRef,
              }
            : null
        )
      })
  }

  const deleteWorkKind = (
    employee: TabelEmployee,
    kind: TabelWorkKind,
    draft: boolean
  ) => {
    if (draft) {
      setDrafts((prev) => ({
        generation,
        byEmployee: {
          ...prev.byEmployee,
          [employee.employeeNodeId]: draftKindsFor(
            employee.employeeNodeId
          ).filter((k) => k.workTimeKindRef !== kind.workTimeKindRef),
        },
      }))
      return
    }
    const name = kind.workTimeKindPresentation ?? String(kind.workTimeKindRef)
    void useConfirmStore
      .getState()
      .ask(t('sdui.tabel.deleteWorkKindConfirm', { name }))
      .then((ok) => {
        if (!ok) return
        void queue.enqueue((p) => {
          const emp = p.employees.find(
            (e) => e.employeeNodeId === employee.employeeNodeId
          )
          const target = emp?.workKinds.find(
            (k) => k.workTimeKindRef === kind.workTimeKindRef
          )
          if (!target || target.protected) return null
          return {
            type: 'DELETE_WORK_KIND',
            employeeNodeId: employee.employeeNodeId,
            employeeRef: employee.employeeRef,
            workTimeKindRef: kind.workTimeKindRef,
          }
        })
      })
  }

  return (
    <div className="flex flex-col gap-2">
      <TabelMatrixToolbar
        busy={queue.busy}
        hasActiveEmployee={activeId !== null}
        manualWorkKinds={payload.manualWorkKinds}
        query={query}
        onQueryChange={setQuery}
        onAddEmployee={addEmployee}
        onOpenPodbor={() => {
          setPodborOpen(true)
        }}
        onAddWorkKind={addWorkKind}
        onExpandAll={() => {
          setCollapsed(new Set())
        }}
        onCollapseAll={() => {
          setCollapsed(new Set(payload.employees.map((e) => e.employeeNodeId)))
        }}
      />
      <TabelMatrixGrid
        days={days}
        employees={filterEmployees(payload.employees, query)}
        collapsed={collapsed}
        activeId={activeId}
        busy={queue.busy}
        draftKindsFor={draftKindsFor}
        onToggle={(id) => {
          setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }}
        onSelect={selectEmployee}
        onDeleteEmployee={deleteEmployee}
        onDeleteKind={deleteWorkKind}
        onCommitCell={commitCell}
      />
      {podborOpen &&
        (picker.optionsSource?.url ? (
          <TabelPodborDialog
            url={picker.optionsSource.url}
            params={picker.optionsSource.params ?? {}}
            existingRefs={existingRefs}
            onAdd={(refs) => {
              setPodborOpen(false)
              const fresh = refs.filter((r) => !existingRefs.has(r))
              if (fresh.length === 0) return
              void queue.enqueue(() => ({
                type: 'ADD_EMPLOYEES',
                employeeRefs: fresh,
              }))
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

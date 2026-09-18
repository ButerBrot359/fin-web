import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useConfirmStore } from '../../../../lib/stores/confirm-store'
import { openReferencePicker } from '../../../../lib/reference-picker-gateway'
import type {
  SotrudnikPickerContract,
  TabelEmployee,
  TabelManualWorkKind,
  TabelMatrixPayload,
  TabelWorkKind,
} from './tabel-matrix-contract'
import { buildReplaceEmployee, normalizeCellInput } from './tabel-matrix-logic'
import type { TabelMatrixQueue } from './tabel-matrix-queue'
import { useTabelDraftKinds } from './use-tabel-draft-kinds'

export interface TabelMatrixActions {
  activeId: string | null
  draftKindsFor: (employeeNodeId: string) => TabelManualWorkKind[]
  selectEmployee: (employee: TabelEmployee) => void
  commitCell: (
    employeeNodeId: string,
    workTimeKindRef: number
  ) => (date: string, raw: string) => boolean | Promise<boolean>
  addEmployee: (picker: SotrudnikPickerContract) => void
  addEmployees: (refs: number[]) => void
  addWorkKind: (kind: TabelManualWorkKind) => void
  deleteEmployee: (employee: TabelEmployee) => void
  deleteWorkKind: (
    employee: TabelEmployee,
    kind: TabelWorkKind,
    draft: boolean
  ) => void
}

/** Хендлеры мутаций матрицы: все команды идут через очередь (spec v1 §4). */
export function useTabelMatrixActions(
  payload: TabelMatrixPayload | null,
  queue: TabelMatrixQueue
): TabelMatrixActions {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<string | null>(null)
  const { draftKindsFor, addWorkKind, removeDraftKind } = useTabelDraftKinds(
    payload,
    activeId
  )
  const generation = payload?.generation ?? -1

  // Новый payload: чистим ссылку на исчезнувшего сотрудника (черновики
  // реконсилирует useTabelDraftKinds по той же смене generation).
  const prevGenerationRef = useRef(generation)
  useEffect(() => {
    if (prevGenerationRef.current === generation || !payload) return
    prevGenerationRef.current = generation
    const ids = new Set(payload.employees.map((e) => e.employeeNodeId))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- реакция на смену серверной generation
    setActiveId((prev) => (prev && ids.has(prev) ? prev : null))
  }, [generation, payload])

  const selectEmployee = (employee: TabelEmployee) => {
    if (activeId === employee.employeeNodeId) return
    const previous = activeId
    setActiveId(employee.employeeNodeId)
    // SELECT_EMPLOYEE связывает строку UI с server-side active row (§4) —
    // обязательна перед «Перезаполнить текущего сотрудника». При отказе
    // сервера откатываем локальный выбор, иначе UI разойдётся с сервером.
    void queue
      .enqueue((p) =>
        p.employees.some((e) => e.employeeNodeId === employee.employeeNodeId)
          ? { type: 'SELECT_EMPLOYEE', employeeRef: employee.employeeRef }
          : null
      )
      .then((ok) => {
        if (!ok) {
          setActiveId((cur) =>
            cur === employee.employeeNodeId ? previous : cur
          )
        }
      })
  }

  const commitCell =
    (employeeNodeId: string, workTimeKindRef: number) =>
    (date: string, raw: string): boolean | Promise<boolean> => {
      const input = normalizeCellInput(raw)
      if (!input.ok) {
        showToast('warning', t('sdui.tabel.invalidHours'))
        return false
      }
      // Промис отдаём ячейке: отказ сервера откатывает её буфер.
      return queue.enqueue((p) =>
        buildReplaceEmployee(
          p,
          employeeNodeId,
          { workTimeKindRef, date, value: input.value },
          draftKindsFor(employeeNodeId).map((k) => k.workTimeKindRef)
        )
      )
    }

  const addEmployee = (picker: SotrudnikPickerContract) => {
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
        if (payload?.employees.some((e) => e.employeeRef === ref)) {
          showToast('info', t('sdui.tabel.alreadyAdded'))
          return
        }
        void queue
          .enqueue((p) =>
            p.employees.some((e) => e.employeeRef === ref)
              ? null
              : { type: 'ADD_EMPLOYEE', employeeRef: ref }
          )
          .then((ok) => {
            // 1С: добавленная строка становится текущей (спека 01.09 §3).
            // Отдельный SELECT_EMPLOYEE в голове очереди: там свежий payload
            // с nodeId новой строки.
            if (!ok) return
            let addedId: string | null = null
            void queue
              .enqueue((p) => {
                const added = p.employees.find((e) => e.employeeRef === ref)
                if (!added) return null
                addedId = added.employeeNodeId
                return { type: 'SELECT_EMPLOYEE', employeeRef: ref }
              })
              .then((selected) => {
                if (selected && addedId) setActiveId(addedId)
              })
          })
      },
    })
  }

  const addEmployees = (refs: number[]) => {
    // Фильтруем по СВЕЖЕМУ payload в голове очереди: сотрудник мог появиться,
    // пока команда ждала, а дубликат атомарно отклонит весь batch (§4).
    void queue.enqueue((p) => {
      const present = new Set(p.employees.map((e) => e.employeeRef))
      const fresh = refs.filter((r) => !present.has(r))
      return fresh.length > 0
        ? { type: 'ADD_EMPLOYEES', employeeRefs: fresh }
        : null
    })
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
      removeDraftKind(employee.employeeNodeId, kind.workTimeKindRef)
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

  return {
    activeId,
    draftKindsFor,
    selectEmployee,
    commitCell,
    addEmployee,
    addEmployees,
    addWorkKind,
    deleteEmployee,
    deleteWorkKind,
  }
}

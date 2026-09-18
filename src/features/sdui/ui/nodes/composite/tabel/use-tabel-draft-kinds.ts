import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type {
  TabelManualWorkKind,
  TabelMatrixPayload,
} from './tabel-matrix-contract'

/** Черновые виды времени, привязанные к generation (spec v1 §5): к payload
 * другой generation черновики не применяются. */
interface DraftKinds {
  generation: number
  byEmployee: Record<string, TabelManualWorkKind[]>
}

export interface TabelDraftKinds {
  draftKindsFor: (employeeNodeId: string) => TabelManualWorkKind[]
  addWorkKind: (kind: TabelManualWorkKind) => void
  removeDraftKind: (employeeNodeId: string, workTimeKindRef: number) => void
}

/**
 * Черновые (несохранённые) виды времени матрицы Табеля (вынесено из
 * use-tabel-matrix-actions.ts, поведение 1:1 при декомпозиции). activeId —
 * текущая строка сотрудника: «Добавить вид времени» работает только по ней.
 */
export function useTabelDraftKinds(
  payload: TabelMatrixPayload | null,
  activeId: string | null
): TabelDraftKinds {
  const { t } = useTranslation()
  const [drafts, setDrafts] = useState<DraftKinds>({
    generation: -1,
    byEmployee: {},
  })
  const generation = payload?.generation ?? -1

  // Новый payload: черновики, уже сохранённые сервером (вид появился в
  // payload), убираем из drafts.
  const prevGenerationRef = useRef(generation)
  useEffect(() => {
    if (prevGenerationRef.current === generation || !payload) return
    prevGenerationRef.current = generation
    // eslint-disable-next-line react-hooks/set-state-in-effect -- реакция на смену серверной generation; поведение 1:1 при декомпозиции
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

  const draftKindsFor = (employeeNodeId: string): TabelManualWorkKind[] =>
    drafts.generation === generation
      ? (drafts.byEmployee[employeeNodeId] ?? [])
      : []

  const addWorkKind = (kind: TabelManualWorkKind) => {
    if (!activeId || !payload) return
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

  const removeDraftKind = (employeeNodeId: string, workTimeKindRef: number) => {
    setDrafts((prev) => ({
      generation,
      byEmployee: {
        ...prev.byEmployee,
        [employeeNodeId]: draftKindsFor(employeeNodeId).filter(
          (k) => k.workTimeKindRef !== workTimeKindRef
        ),
      },
    }))
  }

  return { draftKindsFor, addWorkKind, removeDraftKind }
}

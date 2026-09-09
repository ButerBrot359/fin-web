import { create } from 'zustand'

import { isTargetNavigable } from '../lib/is-target-navigable'
import type { ValidationReport } from '../types/validation-report'

// Отчёт — клиентское состояние сеанса, не server state (v2 §6): его нельзя
// перезапросить, он приходит побочным продуктом мутации. Ключ — маршрут
// экрана (тот же, что у sdui-cache-store): отчёт принадлежит карточке, ошибки
// разных открытых документов не смешиваются (v2 §5.3).
interface ValidationReportStoreState {
  reports: Record<string, ValidationReport>
  /** id активного сообщения (питает тултип-навигатор) по ключу экрана. */
  activeIds: Record<string, string | null>
  /**
   * Ключ активного SDUI-экрана (root-экран один в момент времени).
   * Позволяет узлам дерева находить «свой» отчёт без чтения роутера.
   */
  screenKey: string | null
  setScreenKey: (key: string | null) => void
  /** Новый отчёт ПОЛНОСТЬЮ заменяет прежний список; пустой — гасит панель. */
  setReport: (key: string, report: ValidationReport) => void
  /** Крестик панели / размонтирование экрана / успешная операция. */
  clear: (key: string) => void
  setActive: (key: string, messageId: string | null) => void
  /** Стрелки «‹ ›»: обход ТОЛЬКО навигируемых сообщений, по кругу. */
  stepActive: (key: string, direction: 1 | -1) => void
}

export const useValidationReportStore = create<ValidationReportStoreState>(
  (set) => ({
    reports: {},
    activeIds: {},
    screenKey: null,

    setScreenKey: (key) => {
      set({ screenKey: key })
    },

    setReport: (key, report) => {
      set((s) => {
        if (report.messages.length === 0) {
          return {
            reports: omit(s.reports, key),
            activeIds: omit(s.activeIds, key),
          }
        }
        // Активным сразу становится первое навигируемое сообщение — панель и
        // тултип показываются одновременно, не по клику (v2 §1).
        const first = report.messages.find((m) => isTargetNavigable(m.target))
        return {
          reports: { ...s.reports, [key]: report },
          activeIds: { ...s.activeIds, [key]: first?.id ?? null },
        }
      })
    },

    clear: (key) => {
      set((s) => ({
        reports: omit(s.reports, key),
        activeIds: omit(s.activeIds, key),
      }))
    },

    setActive: (key, messageId) => {
      set((s) => ({ activeIds: { ...s.activeIds, [key]: messageId } }))
    },

    stepActive: (key, direction) => {
      set((s) => {
        if (!(key in s.reports)) return s
        const report = s.reports[key]
        const navigable = report.messages.filter((m) =>
          isTargetNavigable(m.target)
        )
        if (navigable.length === 0) return s
        const current = navigable.findIndex((m) => m.id === s.activeIds[key])
        const next =
          current < 0
            ? 0
            : (current + direction + navigable.length) % navigable.length
        return { activeIds: { ...s.activeIds, [key]: navigable[next].id } }
      })
    },
  })
)

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  return Object.fromEntries(
    Object.entries(record).filter(([k]) => k !== key)
  ) as Record<string, T>
}

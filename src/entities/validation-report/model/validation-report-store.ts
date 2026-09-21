import { create } from 'zustand'

import { isTargetNavigable } from '../lib/is-target-navigable'
import type { ValidationReport } from '../types/validation-report'

// Отчёт — клиентское состояние сеанса, не server state (v2 §6): его нельзя
// перезапросить, он приходит побочным продуктом мутации. Ключ — маршрут
// экрана (тот же, что у sdui-cache-store): отчёт принадлежит карточке, ошибки
// разных открытых документов не смешиваются (v2 §5.3).
//
// SCRUM-317 v4 §4.4: «активное сообщение» (куда ведём) и «тултип открыт»
// (окно) — два РАЗНЫХ состояния. Крестик тултипа закрывает окно, не сбрасывая
// активную строку панели; правка поля вычёркивает строку (dismiss).
interface ValidationReportStoreState {
  reports: Record<string, ValidationReport>
  /** id активного сообщения (питает тултип-навигатор) по ключу экрана. */
  activeIds: Record<string, string | null>
  /** Открыт ли тултип-навигатор по ключу экрана (v4 §4.4, шаг 1). */
  tooltipOpen: Record<string, boolean>
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
  /** Одиночный клик по строке панели: ведём к цели, окно тултипа не трогаем. */
  setActive: (key: string, messageId: string | null) => void
  /** Двойной клик по строке панели: вернуть окно тултипа (v4 §4.4). */
  openTooltip: (key: string) => void
  /** Крестик тултипа: закрыть окно, активная строка панели остаётся. */
  closeTooltip: (key: string) => void
  /** Стрелки «‹ ›»: обход ТОЛЬКО навигируемых сообщений, по кругу. */
  stepActive: (key: string, direction: 1 | -1) => void
  /**
   * Правка поля пользователем вычёркивает строки из панели (v4 §4.4, шаг 2):
   * снятие оптимистичное, правда о документе остаётся за сервером. Последняя
   * убранная строка гасит панель целиком; ушедшая активная строка сбрасывает
   * активность и закрывает тултип.
   */
  dismiss: (key: string, messageIds: string[]) => void
}

export const useValidationReportStore = create<ValidationReportStoreState>(
  (set) => ({
    reports: {},
    activeIds: {},
    tooltipOpen: {},
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
            tooltipOpen: omit(s.tooltipOpen, key),
          }
        }
        // Активным сразу становится первое навигируемое сообщение — панель и
        // тултип показываются одновременно, не по клику (v2 §1); новый отчёт
        // открывает окно тултипа заново (v4 §4.4).
        const first = report.messages.find((m) => isTargetNavigable(m.target))
        return {
          reports: { ...s.reports, [key]: report },
          activeIds: { ...s.activeIds, [key]: first?.id ?? null },
          tooltipOpen: { ...s.tooltipOpen, [key]: true },
        }
      })
    },

    clear: (key) => {
      set((s) => ({
        reports: omit(s.reports, key),
        activeIds: omit(s.activeIds, key),
        tooltipOpen: omit(s.tooltipOpen, key),
      }))
    },

    setActive: (key, messageId) => {
      set((s) => ({ activeIds: { ...s.activeIds, [key]: messageId } }))
    },

    openTooltip: (key) => {
      set((s) => ({ tooltipOpen: { ...s.tooltipOpen, [key]: true } }))
    },

    closeTooltip: (key) => {
      set((s) => ({ tooltipOpen: { ...s.tooltipOpen, [key]: false } }))
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
        return {
          activeIds: { ...s.activeIds, [key]: navigable[next].id },
          // Стрелки живут в самом окне — держат его открытым (v4 §4.4).
          tooltipOpen: { ...s.tooltipOpen, [key]: true },
        }
      })
    },

    dismiss: (key, messageIds) => {
      set((s) => {
        if (!(key in s.reports) || messageIds.length === 0) return s
        const report = s.reports[key]
        const removed = new Set(messageIds)
        const messages = report.messages.filter((m) => !removed.has(m.id))
        if (messages.length === report.messages.length) return s
        if (messages.length === 0) {
          return {
            reports: omit(s.reports, key),
            activeIds: omit(s.activeIds, key),
            tooltipOpen: omit(s.tooltipOpen, key),
          }
        }
        const activeId = s.activeIds[key]
        const activeRemoved = activeId != null && removed.has(activeId)
        return {
          reports: {
            ...s.reports,
            [key]: {
              ...report,
              messages,
              // Единственное место пересчёта blockingCount — компоненты его
              // не считают (v4 §6).
              blockingCount: messages.filter((m) => m.blocking).length,
            },
          },
          activeIds: activeRemoved
            ? { ...s.activeIds, [key]: null }
            : s.activeIds,
          tooltipOpen: activeRemoved
            ? { ...s.tooltipOpen, [key]: false }
            : s.tooltipOpen,
        }
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

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AnalyticsOrganizationState {
  /** Выбранная организация; `null` — все организации. */
  organizationId: number | null
  setOrganizationId: (organizationId: number | null) => void
}

/**
 * Организация, по которой отбираются данные всего раздела «Аналитика».
 *
 * Одна на раздел, а не своя у каждой страницы: бухгалтер выбирает организацию и
 * переходит между дашбордами и отчётами, ожидая видеть ту же. Выбор на каждом
 * экране заново — это отчёт по одной организации рядом с дашбордом по другой.
 *
 * Хранится в `localStorage`, а не в сессии: работают обычно с одной и той же
 * организацией, и выбирать её после каждого входа незачем. Недоступное
 * хранилище (приватный режим) просто не запоминает выбор — страница работает.
 */
export const useAnalyticsOrganizationStore =
  create<AnalyticsOrganizationState>()(
    persist(
      (set) => ({
        organizationId: null,
        setOrganizationId: (organizationId) => {
          set({ organizationId })
        },
      }),
      {
        name: 'analytics-organization',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ organizationId: state.organizationId }),
      }
    )
  )

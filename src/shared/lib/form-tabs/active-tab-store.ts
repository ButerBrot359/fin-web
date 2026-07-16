import { create } from 'zustand'

interface ActiveTabState {
  /** Активная вкладка по ключу «маршрут документа + сигнатура группы вкладок». */
  activeByKey: Record<string, string>
  setActive: (key: string, value: string) => void
}

/**
 * Запоминает активную вкладку ТЧ документа (ТМЗ/Услуги/…), чтобы при возврате к
 * документу через историю/workspace-табы восстанавливалась последняя открытая
 * вкладка, а не первая. In-memory (переживает навигацию в SPA; сбрасывается на
 * полной перезагрузке страницы — этого достаточно для навигации между объектами).
 */
export const useActiveTabStore = create<ActiveTabState>((set) => ({
  activeByKey: {},
  setActive: (key, value) =>
    set((s) => ({ activeByKey: { ...s.activeByKey, [key]: value } })),
}))

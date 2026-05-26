import { create } from 'zustand'

export type FormMode = 'view' | 'edit'

/**
 * Режим карточки счёта — view (по умолчанию) / edit. Хранится по
 * текущему path-у, чтобы переключение между вкладками сохраняло режим.
 * Новая карточка (route /new) всегда стартует в edit.
 */
interface AccountPlanFormModeStore {
  modeByPath: Partial<Record<string, FormMode>>
  setMode: (path: string, mode: FormMode) => void
  getMode: (path: string, fallback: FormMode) => FormMode
}

export const useAccountPlanFormModeStore = create<AccountPlanFormModeStore>(
  (set, get) => ({
    modeByPath: {},
    setMode: (path, mode) => {
      set((state) => ({ modeByPath: { ...state.modeByPath, [path]: mode } }))
    },
    getMode: (path, fallback) => get().modeByPath[path] ?? fallback,
  })
)

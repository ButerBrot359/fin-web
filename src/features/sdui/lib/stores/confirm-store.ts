import { create } from 'zustand'

interface ConfirmStoreState {
  open: boolean
  message: string
  resolve: ((ok: boolean) => void) | null

  // Императивный мост для эффекта confirm (SCRUM-244 §B2): effect-handler
  // (не-React слой) ждёт ответа пользователя промисом, диалог рендерит
  // ConfirmDialogHost. Провод к самому эффекту — после ответа бэка о payload.
  ask: (message: string) => Promise<boolean>
  answer: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmStoreState>((set, get) => ({
  open: false,
  message: '',
  resolve: null,

  ask: (message) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, message, resolve })
    }),

  answer: (ok) => {
    get().resolve?.(ok)
    set({ open: false, message: '', resolve: null })
  },
}))

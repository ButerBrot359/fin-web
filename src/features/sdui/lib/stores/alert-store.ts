import { create } from 'zustand'

// SCRUM-317 §4.2: модальное предупреждение (1С «ПоказатьПредупреждение»).
// В отличие от confirm, промиса нет: пользователь подтверждает прочтение,
// а не действие — команды подтверждения у эффекта не существует.
interface AlertStoreState {
  open: boolean
  message: string
  /** null — хост подставляет свой заголовок из i18n. */
  title: string | null

  show: (message: string, title: string | null) => void
  close: () => void
}

export const useAlertStore = create<AlertStoreState>((set) => ({
  open: false,
  message: '',
  title: null,

  show: (message, title) => {
    set({ open: true, message, title })
  },

  close: () => {
    set({ open: false, message: '', title: null })
  },
}))

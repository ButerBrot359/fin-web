import { create } from 'zustand'

/**
 * Открыт ли диалог «Изменить форму» (конструктор дизайна Ф4).
 *
 * Отдельный стор, а не состояние sdui-screen: команду `view.customizeForm`
 * (customize-form-command.ts) перехватывает dispatch — вне React-дерева,
 * стору оттуда дотянуться проще всего (тот же приём, что panel-store).
 */
interface CustomizeFormStoreState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useCustomizeFormStore = create<CustomizeFormStoreState>((set) => ({
  isOpen: false,
  open: () => {
    set({ isOpen: true })
  },
  close: () => {
    set({ isOpen: false })
  },
}))

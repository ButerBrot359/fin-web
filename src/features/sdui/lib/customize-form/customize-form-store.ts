import { create } from 'zustand'

/**
 * Открыт ли диалог «Изменить форму» (конструктор дизайна Ф4).
 *
 * Отдельный стор, а не состояние sdui-screen: команду `view.customizeForm`
 * (customize-form-command.ts) перехватывает dispatch — вне React-дерева,
 * стору оттуда дотянуться проще всего (тот же приём, что panel-store).
 */
/** Чей слой редактируем: личный пользователя или админский дефолт «для всех» (Ф5). */
export type CustomizeFormMode = 'user' | 'default'

interface CustomizeFormStoreState {
  isOpen: boolean
  mode: CustomizeFormMode
  /** Предвыбранный слой режима default: '' — «для всех», иначе ключ профиля (админка). */
  initialProfile: string
  open: (mode?: CustomizeFormMode, initialProfile?: string) => void
  close: () => void
}

export const useCustomizeFormStore = create<CustomizeFormStoreState>((set) => ({
  isOpen: false,
  mode: 'user',
  initialProfile: '',
  open: (mode = 'user', initialProfile = '') => {
    set({ isOpen: true, mode, initialProfile })
  },
  close: () => {
    set({ isOpen: false })
  },
}))

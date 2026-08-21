import { create } from 'zustand'

/** Ответ пользователя на вопрос «Сохранить изменения?». */
export type UnsavedChangesAnswer = 'save' | 'discard' | 'cancel'

interface UnsavedChangesStoreState {
  open: boolean
  resolve: ((answer: UnsavedChangesAnswer) => void) | null

  /**
   * Императивный мост для эффекта `unsavedChanges` — тот же приём, что у
   * `confirm-store`: не-React слой (effect-handler) ждёт ответа промисом, а
   * диалог рисует хост внутри дерева.
   *
   * Ответов три, а не два: «Отмена» оставляет форму открытой, «Нет, не
   * сохранять» — закрывает, выбросив правки. Свести их к булеву `ok` нельзя,
   * иначе у пользователя не остаётся выхода «закрыть без сохранения».
   */
  ask: () => Promise<UnsavedChangesAnswer>
  answer: (answer: UnsavedChangesAnswer) => void
}

export const useUnsavedChangesStore = create<UnsavedChangesStoreState>(
  (set, get) => ({
    open: false,
    resolve: null,

    ask: () =>
      new Promise<UnsavedChangesAnswer>((resolve) => {
        set({ open: true, resolve })
      }),

    answer: (answer) => {
      get().resolve?.(answer)
      set({ open: false, resolve: null })
    },
  })
)

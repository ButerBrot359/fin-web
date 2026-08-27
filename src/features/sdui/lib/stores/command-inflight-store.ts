import { create } from 'zustand'

import { useSduiSession } from '../sdui-session-context'

// SCRUM-330 Работа 1: in-flight-гард от двойного клика. Пока COMMAND сессии в
// полёте, повторные COMMAND той же сессии дропаются (dispatch), а кнопки
// действий дизейблятся (button-node). Раньше второй запрос ждал блокировку на
// бэке 20 с и падал 409 LOCK_CONFLICT. EVENT/OPEN/CLOSE не гардим: конфликтуют
// только мутирующие команды, а ввод в поля блокировать нельзя.
interface CommandInflightState {
  sessions: Record<string, true>
  begin: (formSessionId: string) => void
  end: (formSessionId: string) => void
}

export const useCommandInflightStore = create<CommandInflightState>((set) => ({
  sessions: {},

  begin: (id) => {
    set((s) => ({ sessions: { ...s.sessions, [id]: true } }))
  },

  end: (id) => {
    set((s) => ({
      sessions: Object.fromEntries(
        Object.entries(s.sessions).filter(([key]) => key !== id)
      ),
    }))
  },
}))

// Кнопка дизейблится только командой СВОЕЙ сессии: панель и корневая форма
// не блокируют друг друга.
export function useCommandInFlight(): boolean {
  const session = useSduiSession()
  const id = session.getSession().formSessionId
  return useCommandInflightStore((s) => (id ? id in s.sessions : false))
}

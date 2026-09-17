/**
 * Шина «пер-пользовательские настройки вида изменились» (конструктор дизайна Ф2).
 *
 * Живёт в shared, а не в sdui: излучатели — чужие миры (ИИ-помощник, позже
 * диалог «Изменить форму»), и импорт feature→feature нарушил бы FSD. SDUI
 * подписывается и сам решает, как перечитать экран; излучатель ничего не знает
 * о механике re-OPEN.
 */

type Listener = () => void

const listeners = new Set<Listener>()

export function subscribeViewSettingsChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyViewSettingsChanged(): void {
  for (const listener of listeners) listener()
}

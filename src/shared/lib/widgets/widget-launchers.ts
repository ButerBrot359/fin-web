/** Commands open the existing mounted widgets; no duplicate chat or call sessions. */
export const AI_WIDGET_NEW_CHAT_EVENT = 'webbuh:new-ai-chat'
export const AI_WIDGET_OPEN_EVENT = 'webbuh:open-ai-widget'
export const SUPPORT_WIDGET_OPEN_EVENT = 'webbuh:open-support-widget'

/**
 * Виджеты-приёмники грузятся лениво (код-сплиттинг оболочки), а window-событие
 * не ждёт слушателя: клик по кнопке шапки сразу после загрузки страницы уходил
 * в пустоту, и панель молча не открывалась. Поэтому команда дополнительно
 * помечается «повисшей», а виджет при монтировании забирает метку и
 * доигрывает открытие. Слушатель, поймавший событие вживую, обязан снять
 * метку тем же consumePendingWidgetEvent — иначе панель откроется повторно
 * при следующем монтировании виджета.
 */
const pendingEvents = new Set<string>()

function fireWidgetEvent(event: string) {
  pendingEvents.add(event)
  window.dispatchEvent(new Event(event))
}

/** Снимает и возвращает метку «команда прозвучала, но её никто не принял». */
export function consumePendingWidgetEvent(event: string): boolean {
  return pendingEvents.delete(event)
}

export function openAiWidget() {
  fireWidgetEvent(AI_WIDGET_OPEN_EVENT)
}
export function startNewAiChat() {
  fireWidgetEvent(AI_WIDGET_NEW_CHAT_EVENT)
}
export function openSupportWidget() {
  fireWidgetEvent(SUPPORT_WIDGET_OPEN_EVENT)
}

/** Set true to restore both floating launch buttons. Header shortcuts stay available. */
export const WIDGET_LAUNCHER_CONFIG = { showFloatingButtons: false }

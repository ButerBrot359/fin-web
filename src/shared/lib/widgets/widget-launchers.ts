/** Commands open the existing mounted widgets; no duplicate chat or call sessions. */
export const AI_WIDGET_OPEN_EVENT = 'webbuh:open-ai-widget'
export const SUPPORT_WIDGET_OPEN_EVENT = 'webbuh:open-support-widget'

export function openAiWidget() {
  window.dispatchEvent(new Event(AI_WIDGET_OPEN_EVENT))
}
export function openSupportWidget() {
  window.dispatchEvent(new Event(SUPPORT_WIDGET_OPEN_EVENT))
}

/** Set true to restore both floating launch buttons. Header shortcuts stay available. */
export const WIDGET_LAUNCHER_CONFIG = { showFloatingButtons: false }

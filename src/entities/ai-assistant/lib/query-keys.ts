/**
 * Ключи кэша контура ИИ-помощника.
 *
 * Отдельный корень от `analyticsKeys`: контуры независимы, и сброс настроек
 * помощника не должен ронять кэш витрин аналитики.
 */
export const aiAssistantKeys = {
  root: ['ai-assistant'] as const,
  settings: () => ['ai-assistant', 'settings'] as const,
  disclosure: () => ['ai-assistant', 'disclosure'] as const,
  conversations: () => ['ai-assistant', 'conversations'] as const,
  conversationMessages: (id: number) =>
    ['ai-assistant', 'conversation', id, 'messages'] as const,
}

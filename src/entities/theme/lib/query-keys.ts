/** Ключи кэша пер-пользовательской темы (конструктор дизайна Ф3). */
export const themeKeys = {
  root: ['theme'] as const,
  merged: () => ['theme', 'merged'] as const,
}

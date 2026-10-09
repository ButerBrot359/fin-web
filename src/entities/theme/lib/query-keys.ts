/** Ключи кэша пер-пользовательской темы (конструктор дизайна Ф3). */
export const themeKeys = {
  root: ['theme'] as const,
  // SCRUM-400 §10 п.3: тема пер-пользовательская — userId в ключе, чтобы при
  // смене пользователя в одной вкладке не применялась чужая (staleTime Infinity).
  merged: (userId: number | null = null) =>
    ['theme', 'merged', userId] as const,
}

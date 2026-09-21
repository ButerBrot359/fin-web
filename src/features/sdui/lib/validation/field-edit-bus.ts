// SCRUM-317 v4 §4.4 (шаг 3): узел поля сообщает хосту панели о правке
// ПОЛЬЗОВАТЕЛЕМ. Хост не может слушать DOM: у ссылочных полей значение
// ставится программно, input-события там нет. Шина — та же форма, что
// reveal-bus: Set обработчиков без состояния, подписчиков единицы.
// Программная перезапись значения (эффекты) идёт тихим сеттером
// setValue(v, { silent: true }) и сюда НЕ попадает.

type FieldEditHandler = (binding: string) => void

const handlers = new Set<FieldEditHandler>()

export function registerFieldEditHandler(
  handler: FieldEditHandler
): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/** Поле с данным binding отредактировано пользователем. */
export function notifyFieldEdited(binding: string): void {
  for (const handler of handlers) handler(binding)
}

// Хоткеи командной панели ТЧ (SCRUM-302, эталон — меню «Ещё» в 1С).
// Слушается на контейнере конкретной таблицы, НЕ на document: на форме
// несколько ТЧ, работает та, в которой фокус. Cmd на mac = Ctrl (кроме
// Cmd+Q — его перехватить нельзя, для сброса поиска только Ctrl+Q).

export interface TableHotkeyHandlers {
  onAdd: () => void
  /** ↑ — перейти на строку выше (в 1С стрелки водят по строкам таблицы). */
  onSelectPrev: () => void
  /** ↓ — перейти на строку ниже. */
  onSelectNext: () => void
  onCopy: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocusSearch: () => void
  onClearSearch: () => void
  /** Ctrl+A — выделить все строки таблицы (в ячейке остаётся выделением текста). */
  onSelectAll?: () => void
  /** Shift + стрелка вверх — расширить выделение на строку выше. */
  onExtendPrev?: () => void
  /** Shift + стрелка вниз — расширить выделение на строку ниже. */
  onExtendNext?: () => void
  /** Ctrl+C — скопировать выделенные строки в буфер обмена. */
  onCopyToClipboard?: () => void
  /** Ctrl+Z — отменить последнее действие над строками. */
  onUndo?: () => void
  /** Ctrl+S — записать документ (в ячейке тоже: правка уже в снимке ТЧ). */
  onSave?: () => void
}

/**
 * Цель события — редактируемое поле ячейки. Экспортируется: те же клавиши, что
 * разбираются здесь, приходят и событием `paste`, и там правило «в инпуте
 * работает инпут» обязано быть тем же.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function createTableHotkeysHandler(
  handlers: TableHotkeyHandlers
): (e: React.KeyboardEvent<HTMLElement>) => void {
  return (e) => {
    const ctrl = e.ctrlKey || e.metaKey

    // Ctrl+S разбирается ДО проверки ячейки: запись документа нужна и из
    // недопечатанной ячейки (её значение уже в снимке ТЧ, а поведение команды
    // записи дошлёт его перед сохранением). preventDefault безусловный — диалог
    // «Сохранить страницу» браузера в форме документа не нужен никогда.
    if (ctrl && e.key.toLowerCase() === 's') {
      e.preventDefault()
      handlers.onSave?.()
      return
    }
    if (ctrl && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      handlers.onFocusSearch()
      return
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'q') {
      e.preventDefault()
      handlers.onClearSearch()
      return
    }
    if (ctrl && e.key.toLowerCase() === 'a' && !e.shiftKey) {
      // В ячейке Ctrl+A обязан остаться «выделить текст» — иначе правка значения
      // превратилась бы в выделение всей таблицы.
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      handlers.onSelectAll?.()
      return
    }
    if (ctrl && e.key.toLowerCase() === 'c' && !e.shiftKey) {
      // В ячейке Ctrl+C обязан остаться «скопировать текст» — как и Ctrl+A.
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      handlers.onCopyToClipboard?.()
      return
    }
    if (ctrl && e.key.toLowerCase() === 'z') {
      // В ячейке Ctrl+Z — отмена ввода символов средствами инпута.
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      handlers.onUndo?.()
      return
    }
    // Ctrl+V здесь НЕ перехватывается намеренно: вставку принимает событие
    // `paste` контейнера таблицы (см. handlePasteEvent). Через событие данные
    // приходят синхронно из `clipboardData`, без разрешения на чтение буфера,
    // которое требуется `navigator.clipboard.readText` и которого в Firefox
    // не получить вовсе.
    if (ctrl && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault()
      handlers.onMoveUp()
      return
    }
    if (ctrl && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault()
      handlers.onMoveDown()
      return
    }

    // Клавиши без модификаторов не должны срабатывать, пока пользователь
    // печатает в ячейке
    if (isEditableTarget(e.target)) return
    if (e.key === 'Insert') {
      e.preventDefault()
      handlers.onAdd()
      return
    }
    if (e.key === 'F9') {
      e.preventDefault()
      handlers.onCopy()
      return
    }
    if (e.key === 'Delete') {
      e.preventDefault()
      handlers.onRemove()
      return
    }
    // Переход по строкам стрелками — платформенное поведение таблицы 1С. Без него
    // в длинной табличной части приходилось крутить колесо мыши: клавиши «не
    // реагировали» (обращение 20.09.2026 по доверенности). Модификаторы уже
    // разобраны выше (Ctrl+Shift+стрелки переставляют строку), а внутри ячейки
    // стрелки остаются за курсором — сюда мы не доходим (isEditableTarget).
    if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault()
      handlers.onExtendPrev?.()
      return
    }
    if (e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault()
      handlers.onExtendNext?.()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      handlers.onSelectPrev()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      handlers.onSelectNext()
    }
  }
}

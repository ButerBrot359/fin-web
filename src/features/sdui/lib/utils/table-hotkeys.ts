// Хоткеи командной панели ТЧ (SCRUM-302, эталон — меню «Ещё» в 1С).
// Слушается на контейнере конкретной таблицы, НЕ на document: на форме
// несколько ТЧ, работает та, в которой фокус. Cmd на mac = Ctrl (кроме
// Cmd+Q — его перехватить нельзя, для сброса поиска только Ctrl+Q).

export interface TableHotkeyHandlers {
  onAdd: () => void
  onCopy: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onFocusSearch: () => void
  onClearSearch: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
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
    }
  }
}

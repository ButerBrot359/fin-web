/**
 * Политика мутаций табличной части (SCRUM-400 §5.6.1): ОДНИ и те же разрешения
 * для всех путей изменения строк — кнопок тулбара, меню «Ещё», горячих клавиш
 * (Ins/F9/Del/Ctrl+Shift+↑↓), вставки Ctrl+V и отмены Ctrl+Z. До неё кнопки
 * гасились по `allow*`, а программные пути (хоткеи, вставка) шли мимо — заперев
 * ТЧ правами, сервер получал бы EVENT'ы и отвечал 403.
 *
 * Семантика флагов — как была до SCRUM-400 для каждого конкретного носителя:
 * права выражаются только явным `false` (бэк эмитит `allow*` явно, SCRUM-362
 * B-4). `readOnly` ТЧ (права либо readOnly корня формы) запрещает всё.
 */
export interface TableMutationPolicy {
  readOnly: boolean
  canAdd: boolean
  canDelete: boolean
  canReorder: boolean
}

export function buildTableMutationPolicy(args: {
  /** `props.readOnly === true` у узла TABLE ИЛИ readOnly сессии формы. */
  tableReadOnly: boolean
  allowAdd: boolean
  allowDelete: boolean
  allowReorder: boolean
}): TableMutationPolicy {
  const { tableReadOnly } = args
  return {
    readOnly: tableReadOnly,
    canAdd: !tableReadOnly && args.allowAdd,
    canDelete: !tableReadOnly && args.allowDelete,
    canReorder: !tableReadOnly && args.allowReorder,
  }
}

/** Политика «всё можно» — для таблиц, где ограничения не заданы. */
export const PERMISSIVE_TABLE_POLICY: TableMutationPolicy = {
  readOnly: false,
  canAdd: true,
  canDelete: true,
  canReorder: true,
}

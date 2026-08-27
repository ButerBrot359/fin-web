/**
 * Цвет текста ВСЕЙ таблицы (`TABLE.props.textColor`) — порт «ЦветТекста»
 * элемента управляемой формы 1С. Эталонный случай — таблица ошибок ЭСФ, там
 * текст красный (#B22222).
 *
 * Отдельный проп, а не тема: цвет приходит с раскладкой конкретной таблицы, и
 * задавать его глобально нельзя. Отсутствие пропа — прежний цвет темы.
 */

/** Цвет из props узла таблицы; пустая строка и не-строка = пропа нет. */
export function tableTextColor(
  props: Record<string, unknown> | undefined
): string | undefined {
  const raw = props?.textColor
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}

/**
 * sx-фрагмент для `<Table>`: цвет проставляется ячейкам, а не корню таблицы —
 * MUI задаёт `MuiTableCell-root { color: text.primary }`, и наследование от
 * `<table>` до него не доходит.
 */
export function tableTextColorSx(
  props: Record<string, unknown> | undefined
): Record<string, unknown> {
  const color = tableTextColor(props)
  return color ? { '& .MuiTableCell-root': { color } } : {}
}

/**
 * Цвет текста из `props.textColor` — порт «ЦветТекста» 1С. Одна функция на два
 * механизма (тела совпадали дословно, дубль слит):
 *
 * <p>— узел ТАБЛИЦЫ (`TABLE.props.textColor`) красит ВСЮ таблицу (эталон —
 * таблица ошибок ЭСФ, красный #B22222) — см. `tableTextColorSx` ниже;
 *
 * <p>— узел КОЛОНКИ (`TABLE_COLUMN.props.textColor`) красит одну колонку —
 * порт УсловногоОформления СКД с пустым отбором (эталон — «К выплате» свода
 * «Итоги», #0000FF), читается в read-only-header-model.ts. Механизмы
 * независимы; колоночный, как более точный, перекрывает табличный.
 *
 * <p>Отдельный проп, а не тема: цвет приходит с раскладкой конкретного узла, и
 * задавать его глобально нельзя. Отсутствие пропа — прежний цвет темы.
 */

/** Цвет из props узла; пустая строка и не-строка = пропа нет. */
export function textColorProp(
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
  const color = textColorProp(props)
  return color ? { '& .MuiTableCell-root': { color } } : {}
}

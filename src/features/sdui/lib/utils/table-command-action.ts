import type { TableCommandDescriptor, ViewAction } from '../../types/view'

// Легаси-команды ТЧ над текущей строкой, которые бэк ещё не помечает
// requiresSelectedRow: признак по префиксу остаётся для обратной совместимости.
const ROW_SCOPED_PREFIXES = ['table.deleteRow', 'table.copyRow']

/**
 * Команда панели ТЧ работает над ТЕКУЩЕЙ строкой: без выбора сервер ответит
 * «Выберите строку…», поэтому кнопка гасится заранее — как в 1С. Источник —
 * декларация бэка requiresSelectedRow; префиксы — только для старых команд.
 */
export function isRowScopedCommand(cmd: TableCommandDescriptor): boolean {
  return (
    cmd.requiresSelectedRow === true ||
    ROW_SCOPED_PREFIXES.some((prefix) => cmd.command.startsWith(prefix + ':'))
  )
}

/**
 * COMMAND кнопки панели ТЧ. Выделено несколько строк — «Удалить» уходит
 * списком rowIds (сервер снимает их одной командой, порт поведения таблицы
 * 1С); иначе value={rowId} выбранной строки. Без выбора value не шлётся вовсе.
 */
export function buildTableCommandAction(
  cmd: TableCommandDescriptor,
  selectedRowId: string | null,
  selectedRowIds: string[] = []
): ViewAction {
  const mnozhestvennoeUdalenie =
    cmd.command.startsWith('table.deleteRow:') && selectedRowIds.length > 1
  return {
    type: 'COMMAND',
    command: cmd.command,
    // Спред, а не value:undefined — иначе ключ value ломает прежние тесты.
    ...(mnozhestvennoeUdalenie
      ? { value: { rowIds: selectedRowIds } }
      : selectedRowId
        ? { value: { rowId: selectedRowId } }
        : {}),
  }
}

/**
 * Команда строки по умолчанию (двойной клик / Enter). Сначала — явная пометка
 * бэка defaultForRow (первая доступная). Без неё — ровно одна команда без группы
 * с requiresSelectedRow=true, и она доступна. Иначе — null: угадывать между
 * «Открыть» и «Удалить» фронт не должен.
 */
export function defaultRowCommand(
  commands: TableCommandDescriptor[]
): TableCommandDescriptor | null {
  const marked = commands.filter((cmd) => cmd.defaultForRow === true)
  if (marked.length > 0) {
    return marked.find((cmd) => cmd.enabled) ?? null
  }
  const rowCommands = commands.filter(
    (cmd) => !cmd.group && cmd.requiresSelectedRow === true
  )
  if (rowCommands.length !== 1) return null
  return rowCommands[0].enabled ? rowCommands[0] : null
}

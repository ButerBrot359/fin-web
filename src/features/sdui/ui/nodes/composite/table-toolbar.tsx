import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CloseIcon from '@mui/icons-material/Close'
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import { figmaIcons } from '@/shared/ui/icons'

import type { TableCommandDescriptor } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type { TableSearchApi } from '../../../lib/hooks/use-table-search'
import { TableMoreMenu } from './table-more-menu'

const ROW_SCOPED_COMMANDS = ['table.deleteRow', 'table.copyRow']

interface TableToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onCopy?: () => void
  canAdd?: boolean
  canCopy?: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
  commands?: TableCommandDescriptor[]
  search: TableSearchApi
  selectedRowId?: string | null
  /** rowId всех выделенных строк — серверная «Удалить» снимает их разом, как в 1С. */
  selectedRowIds?: string[]
}

export const TableToolbar = ({
  onAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  onCopy = () => undefined,
  canAdd = true,
  canCopy = false,
  canMoveUp,
  canMoveDown,
  canRemove,
  allowAdd = true,
  allowReorder = true,
  allowDelete = true,
  commands = [],
  search,
  selectedRowId = null,
  selectedRowIds = [],
}: TableToolbarProps) => {
  const { t, i18n } = useTranslation()
  const dispatch = useSduiDispatch()
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  // Открытая кнопка-подменю панели ТЧ: код группы + её якорь. Групп на панели может быть
  // несколько, поэтому храним какая именно раскрыта, а не просто «открыто/закрыто».
  const [groupMenu, setGroupMenu] = useState<{
    group: string
    anchor: HTMLElement
  } | null>(null)

  const commandLabel = (cmd: TableCommandDescriptor) =>
    i18n.language.startsWith('kz') ? (cmd.labelKz ?? cmd.label) : cmd.label

  // Команды панели ТЧ, которые сервер выполняет НАД ТЕКУЩЕЙ СТРОКОЙ: без выделения
  // сервер отвечает «Выберите строку…», поэтому кнопка гасится заранее — как в 1С.
  const rowScoped = (cmd: TableCommandDescriptor) =>
    ROW_SCOPED_COMMANDS.some((prefix) => cmd.command.startsWith(prefix + ':'))

  // Команды с непустым group собираются под одну кнопку-подменю; порядок групп и кнопок —
  // тот же, в котором их прислал сервер, чтобы панель не «прыгала» между отдачами.
  const plainCommands = commands.filter((cmd) => !cmd.group)
  const groupedCommands = [
    ...commands
      .filter((cmd) => Boolean(cmd.group))
      .reduce<Map<string, TableCommandDescriptor[]>>((acc, cmd) => {
        const key = cmd.group!
        acc.set(key, [...(acc.get(key) ?? []), cmd])
        return acc
      }, new Map()),
  ]

  const runCommand = (cmd: TableCommandDescriptor) => {
    // Выделено несколько строк — «Удалить» уходит списком rowIds: сервер снимает их одной
    // командой, а не N запросами с пересчётом итогов на каждый (порт поведения таблицы 1С).
    const mnozhestvennoeUdalenie =
      cmd.command.startsWith('table.deleteRow:') && selectedRowIds.length > 1
    void dispatch(
      {
        type: 'COMMAND',
        command: cmd.command,
        // rowId нужен построчным командам (table.copyRow); сервер читает его
        // через extractRowId только у них, прочие игнорируют (SCRUM-332 §1).
        // Спред, а не value:undefined — иначе ключ value ломает прежние тесты.
        ...(mnozhestvennoeUdalenie
          ? { value: { rowIds: selectedRowIds } }
          : selectedRowId
            ? { value: { rowId: selectedRowId } }
            : {}),
      },
      cmd.behavior
    )
  }

  return (
    <div className="flex items-center gap-2">
      {allowAdd && (
        // Figma 772:24370: «+ Добавить» — secondary; primary на экране одна,
        // и это главное действие тулбара документа («Провести и закрыть»).
        <Button
          variant="secondary"
          disabled={!canAdd}
          onClick={onAdd}
          startIcon={figmaIcons.plus}
        >
          {t('table.add')}
        </Button>
      )}
      {allowReorder && (
        <>
          <Button
            variant="secondary"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            startIcon={<KeyboardArrowUpIcon sx={{ fontSize: 20 }} />}
          />
          <Button
            variant="secondary"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            startIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
          />
        </>
      )}
      {groupedCommands.map(([group, groupCmds]) => {
        // Кнопка-подменю: бэк пометил команды общим group (props.zapolnitGroup у ТЧ) —
        // в эталоне 1С это «Заполнить» с пунктами внутри, а не кнопки в ряд.
        const label =
          (i18n.language.startsWith('kz')
            ? groupCmds[0].groupLabelKz
            : groupCmds[0].groupLabel) ?? group
        return (
          <span key={`group:${group}`} style={{ display: 'inline-flex' }}>
            <Button
              variant="secondary"
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                setGroupMenu({ group, anchor: e.currentTarget })
              }}
              endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
            >
              {label}
            </Button>
            <Menu
              anchorEl={groupMenu?.group === group ? groupMenu.anchor : null}
              open={groupMenu?.group === group}
              onClose={() => {
                setGroupMenu(null)
              }}
            >
              {groupCmds.map((cmd) => {
                const needsRow = rowScoped(cmd) && !selectedRowId
                return (
                  <MenuItem
                    key={cmd.command}
                    disabled={!cmd.enabled || needsRow}
                    onClick={() => {
                      setGroupMenu(null)
                      runCommand(cmd)
                    }}
                  >
                    {commandLabel(cmd)}
                  </MenuItem>
                )
              })}
            </Menu>
          </span>
        )
      })}
      {plainCommands.map((cmd) => {
        const needsRow = rowScoped(cmd) && !selectedRowId
        const disabled = !cmd.enabled || needsRow
        const reason = !cmd.enabled
          ? cmd.disabledReason
          : needsRow
            ? t('table.selectRowFirst')
            : undefined
        const btn = (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => {
              runCommand(cmd)
            }}
          >
            {commandLabel(cmd)}
          </Button>
        )
        return disabled && reason ? (
          // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
          <Tooltip key={cmd.command} title={reason}>
            <span style={{ display: 'inline-flex' }}>{btn}</span>
          </Tooltip>
        ) : (
          <span key={cmd.command} style={{ display: 'inline-flex' }}>
            {btn}
          </span>
        )
      })}
      <div className="flex-1" />
      <TextField
        size="small"
        placeholder={t('table.searchPlaceholder')}
        value={search.query}
        inputRef={search.inputRef}
        onChange={(e) => {
          search.setQuery(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') search.next()
          if (e.key === 'Escape' && search.query) {
            // Первый Esc чистит поиск и не даёт всплыть выше — иначе форма в
            // MUI Dialog закроется по тому же Escape, потеряв ввод. Пустой
            // query не перехватываем: второй Esc закрывает диалог как обычно.
            search.clear()
            e.stopPropagation()
          }
        }}
        sx={{ width: 200 }}
        slotProps={{
          input: {
            endAdornment: search.query ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={search.clear}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
      <Button
        variant="secondary"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          setMoreAnchor(e.currentTarget)
        }}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
      >
        {t('table.more')}
      </Button>
      <TableMoreMenu
        anchorEl={moreAnchor}
        onClose={() => {
          setMoreAnchor(null)
        }}
        allowAdd={allowAdd}
        allowDelete={allowDelete}
        allowReorder={allowReorder}
        canAdd={canAdd}
        canCopy={canCopy}
        canRemove={canRemove}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onAdd={onAdd}
        onCopy={onCopy}
        onRemove={onRemove}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        hasQuery={Boolean(search.query)}
        onFind={search.focusInput}
        onClearSearch={search.clear}
        commands={commands}
        commandLabel={commandLabel}
        onCommand={runCommand}
      />
    </div>
  )
}

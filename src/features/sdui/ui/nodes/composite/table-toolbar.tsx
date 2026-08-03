import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { Tooltip } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import type { TableCommandDescriptor } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { TableMoreMenu } from './table-more-menu'

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
}: TableToolbarProps) => {
  const { t, i18n } = useTranslation()
  const dispatch = useSduiDispatch()
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)

  const commandLabel = (cmd: TableCommandDescriptor) =>
    i18n.language.startsWith('kz') ? (cmd.labelKz ?? cmd.label) : cmd.label

  const runCommand = (cmd: TableCommandDescriptor) => {
    void dispatch({ type: 'COMMAND', command: cmd.command }, cmd.behavior)
  }

  return (
    <div className="flex items-center gap-2">
      {allowAdd && (
        <Button variant="primary" disabled={!canAdd} onClick={onAdd}>
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
      {commands.map((cmd) => {
        const btn = (
          <Button
            variant="secondary"
            disabled={!cmd.enabled}
            onClick={() => {
              runCommand(cmd)
            }}
          >
            {commandLabel(cmd)}
          </Button>
        )
        return !cmd.enabled && cmd.disabledReason ? (
          // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
          <Tooltip key={cmd.command} title={cmd.disabledReason}>
            <span style={{ display: 'inline-flex' }}>{btn}</span>
          </Tooltip>
        ) : (
          <span key={cmd.command} style={{ display: 'inline-flex' }}>
            {btn}
          </span>
        )
      })}
      <div className="flex-1" />
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
        commands={commands}
        commandLabel={commandLabel}
        onCommand={runCommand}
      />
    </div>
  )
}

import { useState, type FC } from 'react'
import { Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import { useTranslation } from 'react-i18next'

import { DisabledReasonTooltip } from '@/shared/ui/disabled-reason-tooltip'
import { cn } from '@/shared/lib/utils/cn'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

/**
 * Узел дерева (SCRUM-308 §4.1, ADR-0078_SDUI). Правила фактического контракта:
 * `selected`/`expanded` кладутся ТОЛЬКО `true` и только там, где включены —
 * у остальных узлов ключей нет вовсе, поэтому строгие `=== true`. Раскрытость
 * ветки — состояние клиента, сервер задаёт лишь стартовое. У недоступных
 * узлов `enabled: false` + `tooltip` с причиной; у витринных узлов действий
 * нет вовсе (не пустой массив, а отсутствие ключа) — клик лишь раскрывает.
 */
export const TreeItemNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()
  const [expanded, setExpanded] = useState(node.props?.expanded === true)

  const label = (node.props?.label as string | undefined) ?? ''
  const selected = node.props?.selected === true
  const enabled = node.props?.enabled === true
  const reason = node.props?.tooltip as string | undefined
  const children = (node.children ?? []).filter((c) => c.type === 'TREE_NODE')
  const clickCommand = node.actions?.find((a) => a.trigger === 'click')

  const toggle = () => {
    setExpanded((prev) => !prev)
  }

  const handleClick = () => {
    // §9.1: недоступность проверяется в обработчике, не только атрибутом.
    if (!enabled) return
    if (clickCommand?.command) {
      void dispatch(
        {
          type: 'COMMAND',
          command: clickCommand.command,
          value: { id: node.id },
          sourceNodeId: node.id,
        },
        clickCommand.behavior
      )
      return
    }
    // Узел без команды — клик раскрывает/сворачивает ветку.
    if (children.length > 0) toggle()
  }

  return (
    <li className="m-0 list-none p-0">
      <DisabledReasonTooltip reason={reason} block>
        <div
          role="treeitem"
          aria-selected={selected}
          aria-expanded={children.length > 0 ? expanded : undefined}
          aria-disabled={!enabled || undefined}
          tabIndex={enabled ? 0 : -1}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick()
          }}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1.5',
            selected && 'bg-ui-04',
            enabled ? 'cursor-pointer hover:bg-ui-02' : 'cursor-default'
          )}
        >
          {children.length > 0 ? (
            <span
              role="button"
              aria-label={t(expanded ? 'table.collapseRow' : 'table.expandRow')}
              className="flex shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                toggle()
              }}
            >
              {expanded ? (
                <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
              ) : (
                <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
              )}
            </span>
          ) : (
            <span className="shrink-0" style={{ width: 18 }} />
          )}
          <Typography
            variant="body2"
            noWrap
            className={enabled ? 'text-ui-06' : 'text-ui-05'}
          >
            {label}
          </Typography>
        </div>
      </DisabledReasonTooltip>
      {expanded && children.length > 0 && (
        <ul className="m-0 list-none p-0 pl-5">
          {children.map((child) => (
            <TreeItemNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  )
}

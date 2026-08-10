import { useState, type FC, type ReactNode } from 'react'
import { Button, Divider, Menu, Tooltip } from '@mui/material'

import type { ActionBehavior, NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useOverflowCollapsed } from '../../../lib/overflow/overflow-context'
import { useSelection } from '../../../lib/stores/selection-store'
import { useSduiEffects } from '../../../lib/use-sdui-effects'
import { NodeRenderer } from '../../node-renderer'
import { resolveButtonIcon } from './button-icons'
import { resolveButtonPresentation } from './button-presentation'

export const ButtonNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const variantProp = node.props?.variant as string | undefined
  const iconName = node.props?.icon as string | undefined
  const tooltip = node.props?.tooltip as string | undefined

  // SCRUM-284 Δ4: click-действие — единый источник behavior и
  // requiresSelectedRow/selectionField (бэк больше не кладёт их в props).
  const clickAction = node.actions?.find((a) => a.trigger === 'click')

  // behavior приходит по двум каналам (SCRUM-283 §2.5): статический action.behavior
  // и рантайм-override props.behavior. props побеждает — симметрично props.command.
  const behavior =
    (node.props?.behavior as ActionBehavior | undefined) ??
    clickAction?.behavior ??
    null

  const dispatch = useSduiDispatch()
  const effects = useSduiEffects()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  // FE-5: свёрнутые по ширине кнопки командной панели читаются только
  // кнопкой «Ещё» — остальные кнопки контекст игнорируют (default пустой).
  const collapsedNodes = useOverflowCollapsed()
  const overflowNodes = node.id === 'btn.more' ? collapsedNodes : []

  // SCRUM-284 Δ4: активность кнопки пикера — явные поля на ViewNodeAction
  // (click-действие), фронт имя команды не парсит.
  const requiresSelectedRow = clickAction?.requiresSelectedRow === true
  const selectionField = clickAction?.selectionField ?? undefined
  const selectedRowId = useSelection(
    requiresSelectedRow ? (selectionField ?? null) : null
  )
  // SCRUM-288 §2.1: готовый request на click-действии (панель связей) —
  // исполняется эффект-рантаймом напрямую, без COMMAND в форменную сессию.
  const requestAction = clickAction?.request ?? null

  const { muiVariant, isDropdown } = resolveButtonPresentation(
    variantProp,
    !!node.children?.length
  )
  const disabled = !enabled || (requiresSelectedRow && selectedRowId == null)

  const icon = resolveButtonIcon(iconName)
  const isIconOnly = !!icon && !label
  // icon-only: глиф в line-box высоты текстовой строки (1.75em), иначе
  // голый 20px svg делает кнопку ~4px ниже соседних текстовых.
  const content: ReactNode = isIconOnly ? (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', height: '1.75em' }}
    >
      {icon}
    </span>
  ) : (
    // Неизвестная иконка → fallback: label, затем command (кнопка не пустая)
    (icon ?? label ?? command ?? '')
  )
  const ariaLabel = isIconOnly ? (tooltip ?? command ?? undefined) : undefined

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDropdown) {
      setMenuAnchor(e.currentTarget)
      return
    }
    // SCRUM-288 §2.1: панель связей — исполнение готового request (не COMMAND в сессию).
    if (requestAction) {
      void effects.executeActionRequest(
        requestAction,
        requiresSelectedRow ? (selectedRowId ?? undefined) : undefined
      )
      return
    }
    if (command) {
      if (requiresSelectedRow) {
        if (selectedRowId == null) return
        void dispatch(
          {
            type: 'COMMAND',
            command,
            value: { id: selectedRowId },
            sourceNodeId: node.id,
          },
          behavior
        )
        return
      }
      void dispatch({ type: 'COMMAND', command }, behavior)
    }
  }

  const buttonEl = (
    <Button
      variant={muiVariant}
      disabled={disabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      sx={isIconOnly ? { minWidth: 0, px: 1 } : undefined}
    >
      {content}
    </Button>
  )

  return (
    <>
      {tooltip ? (
        // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
        <Tooltip title={tooltip}>
          <span style={{ display: 'inline-flex' }}>{buttonEl}</span>
        </Tooltip>
      ) : (
        buttonEl
      )}
      {isDropdown && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => {
            setMenuAnchor(null)
          }}
        >
          {/* FE-5: свёрнутые по ширине кнопки — верхней секцией перед штатными пунктами. */}
          {overflowNodes.map((c) => (
            <NodeRenderer key={c.id} node={c} />
          ))}
          {overflowNodes.length > 0 && <Divider />}
          {node.children?.map((c) => (
            <NodeRenderer key={c.id} node={c} />
          ))}
        </Menu>
      )}
    </>
  )
}

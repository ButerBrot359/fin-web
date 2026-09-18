import type { FC, ReactNode } from 'react'
import { IconButton } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'

import { useSduiDispatch } from '../../../lib/dispatch'
import type { ReferenceAffordance } from '../../../lib/utils/reference-affordances'

/**
 * Кнопка endAction ссылочного поля: одинаковые sx/tabIndex, действие — на
 * onMouseDown с preventDefault, чтобы клик не отбирал фокус у инпута.
 */
const ReferenceActionIconButton: FC<{
  label: string
  onPress: () => void
  children: ReactNode
}> = ({ label, onPress, children }) => (
  <IconButton
    aria-label={label}
    sx={{ p: '4px', borderRadius: '6px' }}
    tabIndex={-1}
    onMouseDown={(e) => {
      e.preventDefault()
      onPress()
    }}
  >
    {children}
  </IconButton>
)

interface ReferenceEndActionsProps {
  nodeId: string
  open: ReferenceAffordance
  copy: ReferenceAffordance
  /** Легаси-ветка «открыть карточку» доступна (targetTypeCode + editable). */
  canBrowse: boolean
  /** Легаси-дровер записи, уже стоящей в поле (openReferencePicker mode=edit). */
  onLegacyOpen: () => void
}

/**
 * endAction ссылочного поля шапки (reference-field-node.tsx): «открыть
 * карточку» (серверная команда open или легаси-дровер) и «копировать»
 * (только серверной командой). Рендерится ТОЛЬКО при выбранном значении —
 * гейт по selectedOption остаётся у родителя.
 */
export const ReferenceEndActions: FC<ReferenceEndActionsProps> = ({
  nodeId,
  open,
  copy,
  canBrowse,
  onLegacyOpen,
}) => {
  const dispatch = useSduiDispatch()
  const { t } = useTranslation()

  const openAction = open.action
  const copyAction = copy.action

  const runCommand = (command: string) => {
    void dispatch({ type: 'COMMAND', command, sourceNodeId: nodeId })
  }

  return (
    <>
      {openAction ? (
        open.allow === true ? (
          <ReferenceActionIconButton
            label={t('inputs.openReference')}
            onPress={() => {
              runCommand(openAction.command!)
            }}
          >
            <OpenInNewIcon className="text-ui-05" sx={{ fontSize: 20 }} />
          </ReferenceActionIconButton>
        ) : null
      ) : canBrowse ? (
        <ReferenceActionIconButton
          label={t('inputs.openReference')}
          onPress={onLegacyOpen}
        >
          <OpenInNewIcon className="text-ui-05" sx={{ fontSize: 20 }} />
        </ReferenceActionIconButton>
      ) : null}
      {copyAction && copy.allow === true ? (
        <ReferenceActionIconButton
          label={t('inputs.copyReference')}
          onPress={() => {
            runCommand(copyAction.command!)
          }}
        >
          <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 20 }} />
        </ReferenceActionIconButton>
      ) : null}
    </>
  )
}

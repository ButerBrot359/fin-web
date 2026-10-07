import type { FC } from 'react'
import { IconButton, InputAdornment } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useTranslation } from 'react-i18next'

import type { ViewNodeAction } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useCommandInFlight } from '../../../lib/stores/command-inflight-store'

interface StartChoiceAdornmentProps {
  nodeId: string
  action: ViewNodeAction
  label?: string
  enabled: boolean
}

export const StartChoiceAdornment: FC<StartChoiceAdornmentProps> = ({
  nodeId,
  action,
  label,
  enabled,
}) => {
  const dispatch = useSduiDispatch()
  const commandInFlight = useCommandInFlight()
  const { t } = useTranslation()

  return (
    <InputAdornment position="end">
      <IconButton
        aria-label={
          label
            ? `${t('inputs.startChoice')}: ${label}`
            : t('inputs.startChoice')
        }
        sx={{ p: '4px', borderRadius: '6px' }}
        disabled={!enabled || commandInFlight}
        onClick={() => {
          void dispatch(
            { type: 'COMMAND', command: action.command!, sourceNodeId: nodeId },
            action.behavior
          )
        }}
      >
        <MoreHorizIcon className="text-ui-05" sx={{ fontSize: 20 }} />
      </IconButton>
    </InputAdornment>
  )
}

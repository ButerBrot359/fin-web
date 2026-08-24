import { useMemo, useState, type FC } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useSduiDispatch } from '../../../lib/dispatch'
import type { NodeProps } from '../../../types/view'

interface OutputColumn {
  id: string
  label: string
}

function readColumns(value: unknown): OutputColumn[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (
      typeof item !== 'object' ||
      item == null ||
      typeof Reflect.get(item, 'id') !== 'string' ||
      typeof Reflect.get(item, 'label') !== 'string'
    ) {
      return []
    }
    return [
      {
        id: Reflect.get(item, 'id') as string,
        label: Reflect.get(item, 'label') as string,
      },
    ]
  })
}

export const ListOutputDialogNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()
  const columns = useMemo(
    () => readColumns(node.props?.listOutputColumns),
    [node.props?.listOutputColumns]
  )
  const confirmCommand = node.props?.listOutputConfirmCommand as
    | string
    | undefined
  const cancelCommand = node.props?.listOutputCancelCommand as
    | string
    | undefined
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns])
  const selectionKey = `${node.id}:${columnIds.join('|')}`
  const [selection, setSelection] = useState(() => ({
    key: selectionKey,
    ids: columnIds,
  }))
  // A new server dialog starts with all allowed columns selected. Deriving the
  // default avoids synchronously resetting state from an effect on every mount.
  const selectedIds = selection.key === selectionKey ? selection.ids : columnIds
  const setSelectedIds = (ids: string[]) => {
    setSelection({ key: selectionKey, ids })
  }

  const allSelected =
    columnIds.length > 0 && selectedIds.length === columnIds.length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2">
        {t('sdui.listOutput.destination')}: {t('sdui.listOutput.xlsx')}
      </Typography>
      <Typography variant="subtitle2">
        {t('sdui.listOutput.columns')}
      </Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={allSelected}
            indeterminate={selectedIds.length > 0 && !allSelected}
            onChange={(_, checked) => {
              setSelectedIds(checked ? columnIds : [])
            }}
          />
        }
        label={t('sdui.listOutput.selectAll')}
      />
      <FormGroup>
        {columns.map((column) => (
          <FormControlLabel
            key={column.id}
            control={
              <Checkbox
                checked={selectedIds.includes(column.id)}
                onChange={(_, checked) => {
                  setSelectedIds(
                    checked
                      ? [...selectedIds, column.id]
                      : selectedIds.filter((id) => id !== column.id)
                  )
                }}
              />
            }
            label={column.label}
          />
        ))}
      </FormGroup>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          onClick={() => {
            if (cancelCommand) {
              void dispatch({
                type: 'COMMAND',
                command: cancelCommand,
                sourceNodeId: node.id,
              })
            }
          }}
        >
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!confirmCommand || selectedIds.length === 0}
          onClick={() => {
            if (confirmCommand) {
              void dispatch({
                type: 'COMMAND',
                command: confirmCommand,
                value: selectedIds,
                sourceNodeId: node.id,
              })
            }
          }}
        >
          {t('actions.confirm')}
        </Button>
      </Box>
    </Box>
  )
}

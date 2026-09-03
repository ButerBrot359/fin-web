import { useMemo, useState, type FC } from 'react'
import {
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useSelection } from '../../../lib/stores/selection-store'

interface OutputColumn {
  id: string
  label: string
}

function readColumns(node: NodeProps['node']): OutputColumn[] {
  const raw = node.props?.listOutputColumns
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const { id, label } = item as { id?: unknown; label?: unknown }
    if (typeof id !== 'string' || id === '') return []
    return [{ id, label: typeof label === 'string' ? label : id }]
  })
}

/**
 * Диалог «Вывести список»: выбор колонок перед выгрузкой в XLSX.
 *
 * <p>Бэк отдаёт его PAGE-узлом БЕЗ детей — состав в пропах (`listOutputColumns`, команды
 * подтверждения и отмены), а тело рисует клиент. До 02.09.2026 этого рендерера не было
 * вовсе, поэтому кнопка «Вывести список» открывала пустое модальное окно.
 *
 * <p>Контракт подтверждения — `value: {columnIds, onlySelected, selectedRowIds}`
 * (ListExportDownloadCommandHandler). Диалог закрывает СЕРВЕР эффектом closeDialog на обе
 * команды, поэтому клиент его сам не прячет.
 */
export const ListOutputDialog: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()

  const columns = useMemo(() => readColumns(node), [node])
  const confirmCommand = node.props?.listOutputConfirmCommand as
    | string
    | undefined
  const cancelCommand = node.props?.listOutputCancelCommand as
    | string
    | undefined
  const sourceListId = node.props?.listOutputSourceListId as string | undefined
  const selectedRowsSupported =
    node.props?.listOutputSelectedRowsSupported === true

  // Выделение читается из того же реестра и по тому же ключу, что у команд строки
  // (selectionField = id LIST-узла): диалог знает список, из которого открыт.
  const selectedRowId = useSelection(
    selectedRowsSupported ? (sourceListId ?? null) : null
  )

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.id))
  )
  const [onlySelected, setOnlySelected] = useState(false)

  const allChecked = columns.length > 0 && checked.size === columns.length

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleConfirm = () => {
    if (!confirmCommand || checked.size === 0) return
    void dispatch({
      type: 'COMMAND',
      command: confirmCommand,
      value: {
        // Порядок колонок — серверный (как в списке), а не порядок кликов пользователя.
        columnIds: columns.filter((c) => checked.has(c.id)).map((c) => c.id),
        onlySelected,
        selectedRowIds:
          onlySelected && selectedRowId != null ? [selectedRowId] : [],
      },
      sourceNodeId: node.id,
    })
  }

  const handleCancel = () => {
    if (!cancelCommand) return
    void dispatch({ type: 'COMMAND', command: cancelCommand })
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Typography>{t('sdui.listOutput.empty')}</Typography>
        <div className="flex justify-end">
          <Button variant="outlined" onClick={handleCancel}>
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Typography variant="subtitle2">
        {t('sdui.listOutput.columns')}
      </Typography>

      <FormControlLabel
        label={t('sdui.listOutput.all')}
        control={
          <Checkbox
            checked={allChecked}
            indeterminate={checked.size > 0 && !allChecked}
            onChange={() => {
              setChecked(
                allChecked ? new Set() : new Set(columns.map((c) => c.id))
              )
            }}
          />
        }
      />
      <Divider />

      <div className="flex max-h-80 flex-col overflow-y-auto">
        {columns.map((column) => (
          <FormControlLabel
            key={column.id}
            label={column.label}
            control={
              <Checkbox
                checked={checked.has(column.id)}
                onChange={() => {
                  toggle(column.id)
                }}
              />
            }
          />
        ))}
      </div>

      {selectedRowsSupported && (
        <>
          <Divider />
          <FormControlLabel
            label={t('sdui.listOutput.onlySelected')}
            control={
              <Checkbox
                checked={onlySelected}
                disabled={selectedRowId == null}
                onChange={(e) => {
                  setOnlySelected(e.target.checked)
                }}
              />
            }
          />
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outlined" onClick={handleCancel}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={checked.size === 0}
          onClick={handleConfirm}
        >
          {t('sdui.listOutput.confirm')}
        </Button>
      </div>
    </div>
  )
}

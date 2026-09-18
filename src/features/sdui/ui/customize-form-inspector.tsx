import type { FC } from 'react'
import { Checkbox, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { CustomizableNode } from '../lib/customize-form/collect-customizable-nodes'
import type { GridItem } from '../lib/customize-form/grid-zones'
import { CustomizeFormRow } from './customize-form-row'

interface CustomizeFormInspectorProps {
  /** Выбранный элемент грид-зоны (секционный режим). */
  selectedZoneItem: GridItem | undefined
  /** Выбранная легаси-строка (форма без секций). */
  selectedRow: CustomizableNode | null
  busy: boolean
  /** Режим «для всех»: доступно переопределение подписи (Ф5). */
  canEditLabel: boolean
  /** Переопределения подписей: '' — снять; отсутствие ключа — не трогали. */
  labels: Map<string, string>
  rowHidden: boolean
  rowWidth: number | undefined
  canMoveUp: boolean
  canMoveDown: boolean
  onToggleZoneItem: (nodeId: string) => void
  onLabelChange: (nodeId: string, label: string) => void
  onToggleRow: (nodeId: string) => void
  onMoveRow: (nodeId: string, direction: -1 | 1) => void
  onRowWidthChange: (nodeId: string, width: number | undefined) => void
}

/**
 * Панель выбранного элемента под превью «Изменить форму»: галочка видимости
 * (и переопределение подписи в режиме «для всех») для элемента зоны, полная
 * строка настроек для легаси-режима, иначе — подсказка выбрать элемент.
 */
export const CustomizeFormInspector: FC<CustomizeFormInspectorProps> = ({
  selectedZoneItem,
  selectedRow,
  busy,
  canEditLabel,
  labels,
  rowHidden,
  rowWidth,
  canMoveUp,
  canMoveDown,
  onToggleZoneItem,
  onLabelChange,
  onToggleRow,
  onMoveRow,
  onRowWidthChange,
}) => {
  const { t } = useTranslation()

  return (
    <div className="border-ui-03 min-h-12 rounded-lg border px-3 py-2">
      {selectedZoneItem ? (
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              size="small"
              checked={!selectedZoneItem.hidden}
              onChange={() => {
                onToggleZoneItem(selectedZoneItem.nodeId)
              }}
              disabled={busy}
            />
            <Typography variant="body2">
              {t('sdui.customizeForm.showElement', {
                label: selectedZoneItem.label,
              })}
            </Typography>
          </label>
          {canEditLabel && (
            <TextField
              size="small"
              label={t('sdui.customizeForm.labelField')}
              value={
                labels.get(selectedZoneItem.nodeId) ??
                (selectedZoneItem.label === '⋯' ? '' : selectedZoneItem.label)
              }
              onChange={(e) => {
                onLabelChange(selectedZoneItem.nodeId, e.target.value)
              }}
              disabled={busy}
            />
          )}
        </div>
      ) : selectedRow ? (
        <CustomizeFormRow
          node={selectedRow}
          hidden={rowHidden}
          width={rowWidth}
          busy={busy}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onToggle={() => {
            onToggleRow(selectedRow.nodeId)
          }}
          onMove={(direction) => {
            onMoveRow(selectedRow.nodeId, direction)
          }}
          onWidthChange={(width) => {
            onRowWidthChange(selectedRow.nodeId, width)
          }}
        />
      ) : (
        <Typography variant="body2" className="text-ui-05 py-1">
          {t('sdui.customizeForm.selectHint')}
        </Typography>
      )}
    </div>
  )
}

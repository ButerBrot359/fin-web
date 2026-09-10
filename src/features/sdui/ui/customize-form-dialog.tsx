import { useRef, useState, type FC } from 'react'
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'
import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import { viewSettingsApi } from '../api/view-settings-api'
import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import {
  assignOrders,
  buildPatchFromDecisions,
  collectCustomizableNodes,
  type CustomizableNode,
  type NodeDecision,
} from '../lib/customize-form/collect-customizable-nodes'
import {
  cloneZones,
  extractGridZones,
  zoneDecisions,
  type GridZone,
} from '../lib/customize-form/grid-zones'
import { buildPreviewModel } from '../lib/customize-form/build-preview-model'
import {
  downloadViewSettings,
  parseViewSettingsFile,
} from '../lib/customize-form/settings-transfer'
import { useTreeStore } from '../lib/stores/tree-store'
import { CustomizeFormGridEditor } from './customize-form-grid-editor'
import { CustomizeFormPreview } from './customize-form-preview'
import { CustomizeFormRow } from './customize-form-row'

const settingsKey = (screenKey: string) => ['view-settings', screenKey] as const

/**
 * Диалог «Ещё → Изменить форму» (конструктор дизайна, v4 — грид-редактор,
 * спека 2026-09-11): зоны 24-сетки (шапка, полевые вкладки) редактируются
 * drag-n-drop'ом — перемещение за тело, ширина за правую кромку, бросок между
 * строками = новая строка. Элементы вне сеток (подвал, таблицы) — списком с
 * галочками. Формы без грид-зон (bail-out нормализатора) — прежнее схема-превью.
 * Патч накладывает бэк; после сохранения — re-OPEN через шину.
 */
export const CustomizeFormDialog: FC = () => {
  const { t } = useTranslation()
  const isOpen = useCustomizeFormStore((s) => s.isOpen)
  const close = useCustomizeFormStore((s) => s.close)
  const screenKey = useTreeStore((s) => s.screenKey)
  const root = useTreeStore((s) => s.root)
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { data: patch } = useQuery({
    queryKey: settingsKey(screenKey ?? ''),
    queryFn: ({ signal }) => viewSettingsApi.get(screenKey ?? '', signal),
    enabled: isOpen && screenKey != null,
  })

  const [zones, setZones] = useState<GridZone[]>([])
  const [originalRows, setOriginalRows] = useState<CustomizableNode[]>([])
  const [rows, setRows] = useState<CustomizableNode[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [widths, setWidths] = useState<Map<string, number | undefined>>(
    new Map()
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Снимок, из которого заполнено состояние: перезаполняем на открытии/приходе
  // патча, не перетирая правки внутри диалога. Подстройка во время рендера.
  const [seededFrom, setSeededFrom] = useState<unknown>(null)
  if (isOpen && patch != null && seededFrom !== patch) {
    setSeededFrom(patch)
    const hiddenByUser = new Set(
      patch.filter((e) => e.props.visible === false).map((e) => e.nodeId)
    )
    const gridZones = extractGridZones(root, hiddenByUser)
    const gridIds = new Set(gridZones.map((z) => z.zoneId))
    const collected = collectCustomizableNodes(root, patch).filter(
      (r) => !gridIds.has(r.parentId)
    )
    setZones(gridZones)
    setOriginalRows(collected)
    setRows(collected)
    setHidden(new Set(collected.filter((n) => !n.visible).map((n) => n.nodeId)))
    setWidths(new Map(collected.map((n) => [n.nodeId, n.width])))
    setSelectedId(null)
  }

  const hasZones = zones.length > 0
  const selectedZoneItem = zones
    .flatMap((z) => z.rows.flat())
    .find((i) => i.nodeId === selectedId)
  const selectedRow = rows.find((r) => r.nodeId === selectedId) ?? null
  const selectedIndex = rows.findIndex((r) => r.nodeId === selectedId)

  const finish = async () => {
    if (screenKey != null) {
      await queryClient.invalidateQueries({ queryKey: settingsKey(screenKey) })
    }
    notifyViewSettingsChanged()
    close()
  }

  const buildPatch = () => {
    const decisions = new Map<string, NodeDecision>(
      rows.map((row) => [
        row.nodeId,
        { hidden: hidden.has(row.nodeId), width: widths.get(row.nodeId) },
      ])
    )
    assignOrders(originalRows, rows, decisions)
    zoneDecisions(zones, decisions)
    return buildPatchFromDecisions(patch ?? [], decisions)
  }

  const saveMutation = useMutation({
    mutationFn: (nextPatch: ReturnType<typeof buildPatch>) =>
      viewSettingsApi.put(screenKey ?? '', nextPatch),
    onSuccess: finish,
  })
  const resetMutation = useMutation({
    mutationFn: () => viewSettingsApi.reset(screenKey ?? ''),
    onSuccess: finish,
  })
  const busy = saveMutation.isPending || resetMutation.isPending

  const toggle = (nodeId: string) => {
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const toggleZoneItem = (nodeId: string) => {
    setZones((current) => {
      const next = cloneZones(current)
      for (const zone of next) {
        for (const row of zone.rows) {
          const item = row.find((i) => i.nodeId === nodeId)
          if (item) item.hidden = !item.hidden
        }
      }
      return next
    })
  }

  /** Перестановка с соседом ТОЙ ЖЕ группы (легаси-режим без грид-зон). */
  const move = (nodeId: string, direction: -1 | 1) => {
    setRows((current) => {
      const index = current.findIndex((r) => r.nodeId === nodeId)
      if (index < 0) return current
      const parentId = current[index].parentId
      let neighbor = index + direction
      while (
        neighbor >= 0 &&
        neighbor < current.length &&
        current[neighbor].parentId !== parentId
      ) {
        neighbor += direction
      }
      if (neighbor < 0 || neighbor >= current.length) return current
      const next = [...current]
      ;[next[index], next[neighbor]] = [next[neighbor], next[index]]
      return next
    })
  }

  const siblingBounds = (row: CustomizableNode, index: number) => ({
    canMoveUp: rows.slice(0, index).some((r) => r.parentId === row.parentId),
    canMoveDown: rows.slice(index + 1).some((r) => r.parentId === row.parentId),
  })

  const importFile = async (file: File) => {
    try {
      const imported = parseViewSettingsFile(await file.text())
      await viewSettingsApi.put(screenKey ?? '', imported)
      await finish()
    } catch (error) {
      showToast(
        'error',
        error instanceof Error
          ? error.message
          : t('sdui.customizeForm.importFailed')
      )
    }
  }

  if (!isOpen) return null

  const legacyPreview = !hasZones ? buildPreviewModel(root, rows) : null

  return (
    <Dialog
      open={isOpen}
      onClose={busy ? undefined : close}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{t('sdui.customizeForm.title')}</DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        <Typography variant="body2">
          {hasZones
            ? t('sdui.customizeForm.gridHint')
            : t('sdui.customizeForm.previewHint')}
        </Typography>
        {hasZones ? (
          <CustomizeFormGridEditor
            zones={zones}
            selectedId={selectedId}
            busy={busy}
            onSelect={setSelectedId}
            onChange={setZones}
          />
        ) : legacyPreview ? (
          <CustomizeFormPreview
            model={legacyPreview}
            selectedId={selectedId}
            hidden={hidden}
            widths={widths}
            onSelect={setSelectedId}
          />
        ) : (
          <Typography variant="body2">
            {t('sdui.customizeForm.empty')}
          </Typography>
        )}
        {hasZones && rows.length > 0 && (
          <div className="flex flex-col gap-1">
            <Typography variant="body2" className="text-ui-05">
              {t('sdui.customizeForm.otherElements')}
            </Typography>
            {rows.map((row) => (
              <label
                key={row.nodeId}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  size="small"
                  checked={!hidden.has(row.nodeId)}
                  onChange={() => {
                    toggle(row.nodeId)
                  }}
                  disabled={busy}
                />
                <Typography variant="body2">{row.label}</Typography>
              </label>
            ))}
          </div>
        )}
        <div className="border-ui-03 min-h-12 rounded-lg border px-3 py-2">
          {selectedZoneItem ? (
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                size="small"
                checked={!selectedZoneItem.hidden}
                onChange={() => {
                  toggleZoneItem(selectedZoneItem.nodeId)
                }}
                disabled={busy}
              />
              <Typography variant="body2">
                {t('sdui.customizeForm.showElement', {
                  label: selectedZoneItem.label,
                })}
              </Typography>
            </label>
          ) : selectedRow && !hasZones ? (
            <CustomizeFormRow
              node={selectedRow}
              hidden={hidden.has(selectedRow.nodeId)}
              width={widths.get(selectedRow.nodeId)}
              busy={busy}
              {...siblingBounds(selectedRow, selectedIndex)}
              onToggle={() => {
                toggle(selectedRow.nodeId)
              }}
              onMove={(direction) => {
                move(selectedRow.nodeId, direction)
              }}
              onWidthChange={(width) => {
                setWidths((current) =>
                  new Map(current).set(selectedRow.nodeId, width)
                )
              }}
            />
          ) : (
            <Typography variant="body2" className="text-ui-05 py-1">
              {t('sdui.customizeForm.selectHint')}
            </Typography>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importFile(file)
          }}
        />
        <Button
          variant="tertiary"
          onClick={() => {
            downloadViewSettings(
              screenKey ?? '',
              patch ?? [],
              root?.props?.title as string | undefined
            )
          }}
          disabled={busy || screenKey == null || patch == null}
        >
          {t('sdui.customizeForm.export')}
        </Button>
        <Button
          variant="tertiary"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || screenKey == null}
        >
          {t('sdui.customizeForm.import')}
        </Button>
        <Button
          variant="tertiary"
          onClick={() => {
            resetMutation.mutate()
          }}
          disabled={busy || screenKey == null}
        >
          {t('sdui.customizeForm.reset')}
        </Button>
        <Button variant="secondary" onClick={close} disabled={busy}>
          {t('sdui.customizeForm.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            saveMutation.mutate(buildPatch())
          }}
          disabled={busy || screenKey == null || patch == null}
        >
          {t('sdui.customizeForm.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

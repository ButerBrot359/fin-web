import { useMemo, useRef, useState, type FC } from 'react'
import {
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
import { buildPreviewModel } from '../lib/customize-form/build-preview-model'
import {
  downloadViewSettings,
  parseViewSettingsFile,
} from '../lib/customize-form/settings-transfer'
import { useTreeStore } from '../lib/stores/tree-store'
import { CustomizeFormPreview } from './customize-form-preview'
import { CustomizeFormRow } from './customize-form-row'

const settingsKey = (screenKey: string) => ['view-settings', screenKey] as const

/**
 * Диалог «Ещё → Изменить форму» (конструктор дизайна Ф4, v3 — живое превью,
 * решение владельца 11.09): схема реальной сетки формы, клик по плашке
 * выбирает элемент, панель под превью — скрыть/ширина ступенями/двигать в
 * своей группе; каждое действие сразу видно на схеме. Сброс возвращает к
 * серверному дефолту (его задаёт админ — Ф5). Патч накладывает бэк; после
 * сохранения — re-OPEN через шину.
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
    const collected = collectCustomizableNodes(root, patch)
    setOriginalRows(collected)
    setRows(collected)
    setHidden(new Set(collected.filter((n) => !n.visible).map((n) => n.nodeId)))
    setWidths(new Map(collected.map((n) => [n.nodeId, n.width])))
    setSelectedId(null)
  }

  const previewModel = useMemo(
    () => buildPreviewModel(root, rows),
    [root, rows]
  )
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

  /** Перестановка с соседом ТОЙ ЖЕ группы — превью показывает результат сразу. */
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
          {t('sdui.customizeForm.previewHint')}
        </Typography>
        {previewModel ? (
          <CustomizeFormPreview
            model={previewModel}
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
        <div className="border-ui-03 min-h-14 rounded-lg border px-3 py-2">
          {selectedRow ? (
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
            <Typography variant="body2" className="text-ui-05 py-2">
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

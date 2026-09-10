import { useEffect, useRef, useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  downloadViewSettings,
  parseViewSettingsFile,
} from '../lib/customize-form/settings-transfer'
import { useTreeStore } from '../lib/stores/tree-store'
import { CustomizeFormRow } from './customize-form-row'

const settingsKey = (screenKey: string) => ['view-settings', screenKey] as const

/**
 * Диалог «Ещё → Изменить форму» (конструктор дизайна Ф4, v2): видимость,
 * порядок среди соседей и ширина полей текущего экрана + экспорт/импорт
 * настроек файлом. Generic — строится по дереву с провода, конкретных форм
 * не знает. Патч накладывает бэк; после сохранения — re-OPEN через шину.
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

  useEffect(() => {
    if (!isOpen || patch == null) return
    const collected = collectCustomizableNodes(root, patch)
    setOriginalRows(collected)
    setRows(collected)
    setHidden(new Set(collected.filter((n) => !n.visible).map((n) => n.nodeId)))
    setWidths(new Map(collected.map((n) => [n.nodeId, n.width])))
    // Пересобираем состояние только на открытии/приходе патча: правки
    // пользователя внутри открытого диалога перетирать нельзя.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patch])

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

  /** Перестановка с соседом ТОГО ЖЕ родителя — порядок меняется внутри группы. */
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

  const siblingBounds = (row: CustomizableNode, index: number) => {
    const before = rows.slice(0, index).some((r) => r.parentId === row.parentId)
    const after = rows.slice(index + 1).some((r) => r.parentId === row.parentId)
    return { canMoveUp: before, canMoveDown: after }
  }

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
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t('sdui.customizeForm.title')}</DialogTitle>
      <DialogContent className="flex flex-col gap-1">
        <Typography variant="body2" className="pb-2">
          {t('sdui.customizeForm.description')}
        </Typography>
        {rows.length === 0 && (
          <Typography variant="body2">
            {t('sdui.customizeForm.empty')}
          </Typography>
        )}
        {rows.map((row, index) => (
          <div key={row.nodeId} className="flex flex-col gap-1">
            {/* Форма — сетка из групп (колонки, вкладки): двигать можно
                только внутри своей группы, разделитель делает границы
                групп видимыми (замечание владельца 11.09). */}
            {index > 0 && rows[index - 1].parentId !== row.parentId && (
              <Divider className="my-1" />
            )}
            <CustomizeFormRow
              node={row}
              hidden={hidden.has(row.nodeId)}
              width={widths.get(row.nodeId)}
              busy={busy}
              {...siblingBounds(row, index)}
              onToggle={() => {
                toggle(row.nodeId)
              }}
              onMove={(direction) => {
                move(row.nodeId, direction)
              }}
              onWidthChange={(width) => {
                setWidths((current) => new Map(current).set(row.nodeId, width))
              }}
            />
          </div>
        ))}
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

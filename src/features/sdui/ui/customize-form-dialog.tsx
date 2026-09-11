import { useRef, useState, type FC } from 'react'
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'
import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import {
  viewSettingsApi,
  viewSettingsDefaultsApi,
} from '../api/view-settings-api'
import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import {
  assignOrders,
  buildPatchFromDecisions,
  collectCustomizableNodes,
  type CustomizableNode,
  type NodeDecision,
} from '../lib/customize-form/collect-customizable-nodes'
import {
  extractGridZones,
  type GridZone,
} from '../lib/customize-form/grid-zones'
import {
  buildPageSections,
  collectTableColumns,
  sectionDecisions,
  type PageSection,
} from '../lib/customize-form/page-sections'
import { buildPreviewModel } from '../lib/customize-form/build-preview-model'
import {
  downloadViewSettings,
  parseViewSettingsFile,
} from '../lib/customize-form/settings-transfer'
import { useTreeStore } from '../lib/stores/tree-store'
import { CustomizeFormPreview } from './customize-form-preview'
import { CustomizeFormRow } from './customize-form-row'
import { CustomizeFormSectionCard } from './customize-form-section-card'

const settingsKey = (screenKey: string, mode: string) =>
  ['view-settings', mode, screenKey] as const

/**
 * Диалог «Ещё → Изменить форму» (конструктор дизайна, v5 — страница секциями,
 * модель владельца 11.09): страница — вертикальная стопка блоков; блоки
 * переставляются и скрываются, зоны полей редактируются DnD по 24-сетке,
 * вкладки скрываются галочками (полевые несут свою зону, табличные — колонки).
 * Формы без секций — прежнее схема-превью. Патч накладывает бэк; после
 * сохранения — re-OPEN через шину.
 */
export const CustomizeFormDialog: FC = () => {
  const { t } = useTranslation()
  const isOpen = useCustomizeFormStore((s) => s.isOpen)
  const mode = useCustomizeFormStore((s) => s.mode)
  const close = useCustomizeFormStore((s) => s.close)
  // Ф5: режим «для всех» пишет админский дефолт тем же диалогом.
  const api = mode === 'default' ? viewSettingsDefaultsApi : viewSettingsApi
  const screenKey = useTreeStore((s) => s.screenKey)
  const root = useTreeStore((s) => s.root)
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { data: patch } = useQuery({
    queryKey: settingsKey(screenKey ?? '', mode),
    queryFn: ({ signal }) => api.get(screenKey ?? '', signal),
    enabled: isOpen && screenKey != null,
  })

  const [sections, setSections] = useState<PageSection[]>([])
  const [originalRows, setOriginalRows] = useState<CustomizableNode[]>([])
  const [rows, setRows] = useState<CustomizableNode[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [widths, setWidths] = useState<Map<string, number | undefined>>(
    new Map()
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Переопределения подписей (Ф5): '' — снять; отсутствие ключа — не трогали. */
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  // Снимок, из которого заполнено состояние: перезаполняем на открытии/приходе
  // патча, не перетирая правки внутри диалога. Подстройка во время рендера.
  const [seededFrom, setSeededFrom] = useState<unknown>(null)
  if (isOpen && patch != null && seededFrom !== patch) {
    setSeededFrom(patch)
    const hiddenByUser = new Set(
      patch.filter((e) => e.props.visible === false).map((e) => e.nodeId)
    )
    const zones = extractGridZones(root, hiddenByUser)
    const zonesById = new Map(zones.map((z) => [z.zoneId, z]))
    const tableColumns = collectTableColumns(root, hiddenByUser)
    const built = buildPageSections(root, zonesById, hiddenByUser, tableColumns)
    setSections(built)
    if (built.length === 0) {
      const collected = collectCustomizableNodes(root, patch)
      setOriginalRows(collected)
      setRows(collected)
      setHidden(
        new Set(collected.filter((n) => !n.visible).map((n) => n.nodeId))
      )
      setWidths(new Map(collected.map((n) => [n.nodeId, n.width])))
    } else {
      setOriginalRows([])
      setRows([])
      setHidden(new Set())
      setWidths(new Map())
    }
    setSelectedId(null)
    setLabels(
      new Map(
        patch
          .filter((e) => typeof e.props.label === 'string')
          .map((e) => [e.nodeId, e.props.label as string])
      )
    )
  }

  const hasSections = sections.length > 0
  const allZoneItems = sections.flatMap((s) => [
    ...(s.zone?.rows.flat() ?? []),
    ...(s.tabs?.flatMap((tab) => tab.zone?.rows.flat() ?? []) ?? []),
  ])
  const selectedZoneItem = allZoneItems.find((i) => i.nodeId === selectedId)
  const selectedRow = rows.find((r) => r.nodeId === selectedId) ?? null
  const selectedIndex = rows.findIndex((r) => r.nodeId === selectedId)

  const finish = async () => {
    if (screenKey != null) {
      await queryClient.invalidateQueries({
        queryKey: ['view-settings'],
      })
    }
    notifyViewSettingsChanged()
    close()
  }

  const buildPatch = () => {
    const decisions = new Map<string, NodeDecision>()
    if (hasSections) {
      sectionDecisions(sections, decisions)
    } else {
      for (const row of rows) {
        decisions.set(row.nodeId, {
          hidden: hidden.has(row.nodeId),
          width: widths.get(row.nodeId),
        })
      }
      assignOrders(originalRows, rows, decisions)
    }
    // Подписи (Ф5): дополняем решения переопределениями, не стирая прочие пропы.
    for (const [nodeId, label] of labels) {
      const decision = decisions.get(nodeId) ?? { hidden: false }
      const trimmed = label.trim()
      const hadBefore = (patch ?? []).some(
        (e) => e.nodeId === nodeId && typeof e.props.label === 'string'
      )
      if (trimmed !== '') decision.label = trimmed
      else if (hadBefore) decision.label = null
      decisions.set(nodeId, decision)
    }
    return buildPatchFromDecisions(patch ?? [], decisions)
  }

  const saveMutation = useMutation({
    mutationFn: (nextPatch: ReturnType<typeof buildPatch>) =>
      api.put(screenKey ?? '', nextPatch),
    onSuccess: finish,
  })
  const resetMutation = useMutation({
    mutationFn: () => api.reset(screenKey ?? ''),
    onSuccess: finish,
  })
  const busy = saveMutation.isPending || resetMutation.isPending

  // ── Мутации секций (все через глубокую копию) ────────────────────────────

  const mutateSections = (fn: (next: PageSection[]) => void) => {
    setSections((current) => {
      const next = current.map((s) => ({
        ...s,
        zone: s.zone
          ? {
              ...s.zone,
              rows: s.zone.rows.map((r) => r.map((i) => ({ ...i }))),
            }
          : undefined,
        tabs: s.tabs?.map((tab) => ({
          ...tab,
          zone: tab.zone
            ? {
                ...tab.zone,
                rows: tab.zone.rows.map((r) => r.map((i) => ({ ...i }))),
              }
            : undefined,
          tableColumns: tab.tableColumns?.map((c) => ({ ...c })),
        })),
      }))
      fn(next)
      return next
    })
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    mutateSections((next) => {
      const target = index + direction
      if (target < 0 || target >= next.length) return
      ;[next[index], next[target]] = [next[target], next[index]]
    })
  }

  const replaceZone = (zoneId: string, zone: GridZone) => {
    mutateSections((next) => {
      for (const section of next) {
        if (section.zone?.zoneId === zoneId) section.zone = zone
        for (const tab of section.tabs ?? []) {
          if (tab.zone?.zoneId === zoneId) tab.zone = zone
        }
      }
    })
  }

  const toggleZoneItem = (nodeId: string) => {
    mutateSections((next) => {
      for (const section of next) {
        const zones = [
          section.zone,
          ...(section.tabs?.map((tab) => tab.zone) ?? []),
        ]
        for (const zone of zones) {
          for (const row of zone?.rows ?? []) {
            const item = row.find((i) => i.nodeId === nodeId)
            if (item) item.hidden = !item.hidden
          }
        }
      }
    })
  }

  const toggle = (nodeId: string) => {
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  /** Перестановка с соседом ТОЙ ЖЕ группы (легаси-режим без секций). */
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
      await api.put(screenKey ?? '', imported)
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

  const legacyPreview = !hasSections ? buildPreviewModel(root, rows) : null

  return (
    <Dialog
      open={isOpen}
      onClose={busy ? undefined : close}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {t(
          mode === 'default'
            ? 'sdui.customizeForm.defaultTitle'
            : 'sdui.customizeForm.title'
        )}
      </DialogTitle>
      <DialogContent className="flex flex-col gap-3">
        {mode === 'default' && (
          <Typography variant="body2" className="text-support-01">
            {t('sdui.customizeForm.defaultWarning')}
          </Typography>
        )}
        <Typography variant="body2">
          {hasSections
            ? t('sdui.customizeForm.sectionsHint')
            : t('sdui.customizeForm.previewHint')}
        </Typography>
        {hasSections ? (
          sections.map((section, index) => (
            <CustomizeFormSectionCard
              key={section.nodeId}
              section={section}
              canMoveUp={index > 0}
              canMoveDown={index < sections.length - 1}
              busy={busy}
              selectedId={selectedId}
              onMove={(direction) => {
                moveSection(index, direction)
              }}
              onToggleSection={() => {
                mutateSections((next) => {
                  next[index].hidden = !next[index].hidden
                })
              }}
              onToggleTab={(tabId) => {
                mutateSections((next) => {
                  const tab = next[index].tabs?.find((x) => x.nodeId === tabId)
                  if (tab) tab.hidden = !tab.hidden
                })
              }}
              onToggleColumn={(tabId, columnId) => {
                mutateSections((next) => {
                  const tab = next[index].tabs?.find((x) => x.nodeId === tabId)
                  const column = tab?.tableColumns?.find(
                    (c) => c.nodeId === columnId
                  )
                  if (column) column.hidden = !column.hidden
                })
              }}
              onZoneChange={replaceZone}
              onSelect={setSelectedId}
            />
          ))
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
        <div className="border-ui-03 min-h-12 rounded-lg border px-3 py-2">
          {selectedZoneItem ? (
            <div className="flex flex-wrap items-center gap-4">
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
              {mode === 'default' && (
                <TextField
                  size="small"
                  label={t('sdui.customizeForm.labelField')}
                  value={
                    labels.get(selectedZoneItem.nodeId) ??
                    (selectedZoneItem.label === '⋯'
                      ? ''
                      : selectedZoneItem.label)
                  }
                  onChange={(e) => {
                    setLabels((current) =>
                      new Map(current).set(
                        selectedZoneItem.nodeId,
                        e.target.value
                      )
                    )
                  }}
                  disabled={busy}
                />
              )}
            </div>
          ) : selectedRow && !hasSections ? (
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

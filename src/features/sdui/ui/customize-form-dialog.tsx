import { useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import {
  viewSettingsApi,
  type ViewSettingsPatchEntry,
} from '../api/view-settings-api'
import { useCustomizeFormStore } from '../lib/customize-form/customize-form-store'
import type { CustomizableNode } from '../lib/customize-form/collect-customizable-nodes'
import type { PageSection } from '../lib/customize-form/page-sections'
import { buildSettingsPatch } from '../lib/customize-form/build-settings-patch'
import {
  moveRow,
  siblingBounds,
  toggleRowHidden,
} from '../lib/customize-form/legacy-row-mutations'
import { toggleZoneItem } from '../lib/customize-form/section-mutations'
import { seedEditorState } from '../lib/customize-form/seed-editor-state'
import { buildPreviewModel } from '../lib/customize-form/build-preview-model'
import { useViewSettingsActions } from '../lib/hooks/use-view-settings-actions'
import { useViewSettingsLayer } from '../lib/hooks/use-view-settings-layer'
import { useTreeStore } from '../lib/stores/tree-store'
import { CustomizeFormInspector } from './customize-form-inspector'
import { CustomizeFormPreview } from './customize-form-preview'
import { CustomizeFormScopeSelect } from './customize-form-scope-select'
import { CustomizeFormSectionList } from './customize-form-section-list'
import { ShareViewSettingsDialog } from './share-view-settings-dialog'
import { ViewSettingsPresetsDialog } from './view-settings-presets-dialog'

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
  const screenKey = useTreeStore((s) => s.screenKey)
  const root = useTreeStore((s) => s.root)

  // Пер-ролевые дефолты: в режиме «для всех» админ выбирает слой — общий ('')
  // или профиль групп доступа. На открытии — предвыбор из стора (админка
  // передаёт роль), по умолчанию «для всех».
  const initialProfile = useCustomizeFormStore((s) => s.initialProfile)
  const [profile, setProfile] = useState('')
  const [wasOpen, setWasOpen] = useState(false)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) setProfile(initialProfile)
  }

  const { api, patch, profiles } = useViewSettingsLayer({
    isOpen,
    mode,
    profile,
    screenKey,
  })
  const { finish, save, reset, busy } = useViewSettingsActions({
    api,
    mode,
    profile,
    screenKey,
    close,
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
    const seed = seedEditorState(root, patch)
    setSections(seed.sections)
    setOriginalRows(seed.rows)
    setRows(seed.rows)
    setHidden(seed.hidden)
    setWidths(seed.widths)
    setSelectedId(null)
    setLabels(seed.labels)
  }

  const hasSections = sections.length > 0
  const allZoneItems = sections.flatMap((s) => [
    ...(s.zone?.rows.flat() ?? []),
    ...(s.tabs?.flatMap((tab) => tab.zone?.rows.flat() ?? []) ?? []),
  ])
  const selectedZoneItem = allZoneItems.find((i) => i.nodeId === selectedId)
  const selectedRow = rows.find((r) => r.nodeId === selectedId) ?? null
  const selectedIndex = rows.findIndex((r) => r.nodeId === selectedId)

  const buildPatch = () =>
    buildSettingsPatch({
      sections,
      originalRows,
      rows,
      hidden,
      widths,
      labels,
      patch,
    })

  // «Поделиться настройками» / «Готовые настройки»: общий каталог пресетов.
  // Только личный режим — админ-дефолт («для всех») и есть общая настройка.
  const [shareOpen, setShareOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const presetsAvailable = mode !== 'default' && screenKey != null

  const applyPreset = async (presetPatch: ViewSettingsPatchEntry[]) => {
    await viewSettingsApi.put(screenKey ?? '', presetPatch)
    setPresetsOpen(false)
    await finish()
  }

  if (!isOpen) return null

  const legacyPreview = !hasSections ? buildPreviewModel(root, rows) : null

  return (
    <>
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
            <CustomizeFormScopeSelect
              profile={profile}
              profiles={profiles}
              busy={busy}
              onChange={setProfile}
            />
          )}
          <Typography variant="body2">
            {hasSections
              ? t('sdui.customizeForm.sectionsHint')
              : t('sdui.customizeForm.previewHint')}
          </Typography>
          {hasSections ? (
            <CustomizeFormSectionList
              sections={sections}
              busy={busy}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={setSections}
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
          <CustomizeFormInspector
            selectedZoneItem={selectedZoneItem}
            selectedRow={hasSections ? null : selectedRow}
            busy={busy}
            canEditLabel={mode === 'default'}
            labels={labels}
            rowHidden={selectedRow != null && hidden.has(selectedRow.nodeId)}
            rowWidth={selectedRow ? widths.get(selectedRow.nodeId) : undefined}
            {...siblingBounds(rows, selectedRow, selectedIndex)}
            onToggleZoneItem={(nodeId) => {
              setSections((current) => toggleZoneItem(current, nodeId))
            }}
            onLabelChange={(nodeId, label) => {
              setLabels((current) => new Map(current).set(nodeId, label))
            }}
            onToggleRow={(nodeId) => {
              setHidden((current) => toggleRowHidden(current, nodeId))
            }}
            onMoveRow={(nodeId, direction) => {
              setRows((current) => moveRow(current, nodeId, direction))
            }}
            onRowWidthChange={(nodeId, width) => {
              setWidths((current) => new Map(current).set(nodeId, width))
            }}
          />
        </DialogContent>
        <DialogActions>
          {presetsAvailable && (
            <>
              <Button
                variant="tertiary"
                onClick={() => {
                  setShareOpen(true)
                }}
                disabled={busy}
              >
                {t('sdui.customizeForm.share')}
              </Button>
              <Button
                variant="tertiary"
                onClick={() => {
                  setPresetsOpen(true)
                }}
                disabled={busy}
              >
                {t('sdui.customizeForm.presets')}
              </Button>
            </>
          )}
          <Button
            variant="tertiary"
            onClick={reset}
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
              save(buildPatch())
            }}
            disabled={busy || screenKey == null || patch == null}
          >
            {t('sdui.customizeForm.save')}
          </Button>
        </DialogActions>
      </Dialog>
      {presetsAvailable && (
        <>
          <ShareViewSettingsDialog
            open={shareOpen}
            screenKey={screenKey}
            buildPatch={buildPatch}
            onClose={() => {
              setShareOpen(false)
            }}
          />
          <ViewSettingsPresetsDialog
            open={presetsOpen}
            screenKey={screenKey}
            onApply={applyPreset}
            onClose={() => {
              setPresetsOpen(false)
            }}
          />
        </>
      )}
    </>
  )
}

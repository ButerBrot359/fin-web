import { useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewSettingsPatchEntry } from '../api/view-settings-api'
import {
  viewSettingsPresetsApi,
  type ViewSettingsPresetSummary,
} from '../api/view-settings-presets-api'

interface ViewSettingsPresetsDialogProps {
  open: boolean
  screenKey: string
  /** Применяет патч пресета к личным настройкам (PUT + re-OPEN) — делает родитель. */
  onApply: (patch: ViewSettingsPatchEntry[]) => Promise<void>
  onClose: () => void
}

type PendingAction =
  | { kind: 'apply'; preset: ViewSettingsPresetSummary }
  | { kind: 'delete'; preset: ViewSettingsPresetSummary }
  | null

const presetsKey = (screenKey: string, search: string) =>
  ['view-settings-presets', screenKey, search] as const

/**
 * Каталог «Готовых настроек» экрана: пресеты, опубликованные коллегами с той же
 * ролью (фильтрует бэк). Применение заменяет личные настройки целиком — с
 * подтверждением; свой пресет можно удалить.
 */
export const ViewSettingsPresetsDialog: FC<ViewSettingsPresetsDialogProps> = ({
  open,
  screenKey,
  onApply,
  onClose,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<PendingAction>(null)

  const { data: presets, isLoading } = useQuery({
    queryKey: presetsKey(screenKey, search.trim()),
    queryFn: ({ signal }) =>
      viewSettingsPresetsApi.list(screenKey, search.trim(), signal),
    enabled: open,
  })

  const applyMutation = useMutation({
    mutationFn: async (presetId: number) => {
      const patch = await viewSettingsPresetsApi.getPatch(presetId)
      await onApply(patch)
    },
    onError: () => {
      showToast('error', t('sdui.customizeForm.presetsApplyFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (presetId: number) => viewSettingsPresetsApi.remove(presetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['view-settings-presets'],
      })
    },
    onError: () => {
      showToast('error', t('sdui.customizeForm.presetsDeleteFailed'))
    },
  })

  const busy = applyMutation.isPending || deleteMutation.isPending

  const confirmPending = () => {
    if (!pending) return
    if (pending.kind === 'apply') applyMutation.mutate(pending.preset.id)
    else deleteMutation.mutate(pending.preset.id)
    setPending(null)
  }

  const subtitleOf = (preset: ViewSettingsPresetSummary) => {
    const parts = [
      preset.mine
        ? t('sdui.customizeForm.presetsMine')
        : (preset.authorName ?? ''),
      preset.updatedAt ? format(new Date(preset.updatedAt), 'dd.MM.yyyy') : '',
    ]
    return parts.filter(Boolean).join(' · ')
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={busy ? undefined : onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('sdui.customizeForm.presetsTitle')}</DialogTitle>
        <DialogContent className="flex flex-col gap-4">
          <TextField
            size="small"
            placeholder={t('sdui.customizeForm.presetsSearch')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
            }}
          />
          <div className="flex flex-col gap-2">
            {(presets ?? []).map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-solid border-divider px-4 py-2"
              >
                <div className="min-w-0">
                  <Typography variant="body1" className="truncate font-medium">
                    {preset.name}
                  </Typography>
                  <Typography variant="caption" className="text-support-01">
                    {subtitleOf(preset)}
                  </Typography>
                </div>
                <div className="flex shrink-0 gap-2">
                  {preset.mine && (
                    <Button
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => {
                        setPending({ kind: 'delete', preset })
                      }}
                    >
                      {t('sdui.customizeForm.presetsDelete')}
                    </Button>
                  )}
                  <Button
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => {
                      setPending({ kind: 'apply', preset })
                    }}
                  >
                    {t('sdui.customizeForm.presetsApply')}
                  </Button>
                </div>
              </div>
            ))}
            {!isLoading && (presets ?? []).length === 0 && (
              <Typography variant="body2" className="text-support-01">
                {t('sdui.customizeForm.presetsEmpty')}
              </Typography>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('sdui.customizeForm.cancel')}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={pending != null}
        title={
          pending?.kind === 'delete'
            ? t('sdui.customizeForm.presetsDeleteConfirmTitle')
            : t('sdui.customizeForm.presetsApplyConfirmTitle')
        }
        message={
          pending?.kind === 'delete'
            ? t('sdui.customizeForm.presetsDeleteConfirm', {
                name: pending.preset.name,
              })
            : t('sdui.customizeForm.presetsApplyConfirm', {
                name: pending?.preset.name ?? '',
              })
        }
        confirmLabel={
          pending?.kind === 'delete'
            ? t('sdui.customizeForm.presetsDelete')
            : t('sdui.customizeForm.presetsApply')
        }
        cancelLabel={t('sdui.customizeForm.cancel')}
        onConfirm={confirmPending}
        onCancel={() => {
          setPending(null)
        }}
      />
    </>
  )
}

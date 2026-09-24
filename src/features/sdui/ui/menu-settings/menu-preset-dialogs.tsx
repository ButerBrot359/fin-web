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
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import {
  menuSettingsApi,
  type MenuSettingsPatch,
} from '../../api/menu-settings-api'

interface SharePresetDialogProps {
  open: boolean
  onClose: () => void
  /** Черновик редактора на момент открытия — что публикуем. */
  patch: MenuSettingsPatch
}

/** Публикация текущего черновика меню как пресета (SCRUM-426, 25.09). */
export const SharePresetDialog: FC<SharePresetDialogProps> = ({
  open,
  onClose,
  patch,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const publish = useMutation({
    mutationFn: () => menuSettingsApi.publishPreset(name.trim(), patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['menu-presets'] })
      setName('')
      onClose()
    },
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('sdui.menuSettings.shareTitle')}</DialogTitle>
      <DialogContent className="flex flex-col gap-4 pt-2">
        <Typography variant="body2" className="text-ui-05">
          {t('sdui.menuSettings.shareHint')}
        </Typography>
        <TextField
          autoFocus
          size="small"
          label={t('sdui.menuSettings.presetName')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
        />
        {publish.isError && (
          <Typography variant="body2" className="text-support-01">
            {t('sdui.menuSettings.shareError')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          {t('sdui.menuSettings.close')}
        </Button>
        <Button
          disabled={
            publish.isPending ||
            name.trim() === '' ||
            Object.keys(patch).length === 0
          }
          onClick={() => {
            publish.mutate()
          }}
        >
          {t('sdui.menuSettings.publish')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface PresetsDialogProps {
  open: boolean
  onClose: () => void
  busy: boolean
  onApply: (presetId: number) => void
}

/** Каталог пресетов меню: применить в личный слой, удалить свой. */
export const PresetsDialog: FC<PresetsDialogProps> = ({
  open,
  onClose,
  busy,
  onApply,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: presets, isPending } = useQuery({
    queryKey: ['menu-presets'],
    queryFn: ({ signal }) => menuSettingsApi.presets(signal),
    enabled: open,
  })

  const remove = useMutation({
    mutationFn: (id: number) => menuSettingsApi.deletePreset(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['menu-presets'] }),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('sdui.menuSettings.presetsTitle')}</DialogTitle>
      <DialogContent className="flex min-h-40 flex-col gap-2">
        {isPending && (
          <Typography variant="body2" className="text-ui-05">
            {t('sdui.menuSettings.loading')}
          </Typography>
        )}
        {!isPending && (presets ?? []).length === 0 && (
          <Typography variant="body2" className="text-ui-05">
            {t('sdui.menuSettings.presetsEmpty')}
          </Typography>
        )}
        {(presets ?? []).map((preset) => (
          <div
            key={preset.id}
            className="flex items-center gap-2 rounded-lg border border-solid border-divider px-4 py-2"
          >
            <div className="min-w-0 flex-1">
              <Typography variant="body2" className="truncate">
                {preset.name}
              </Typography>
              <Typography variant="caption" className="text-ui-05">
                {preset.mine
                  ? t('sdui.menuSettings.presetMine')
                  : t('sdui.menuSettings.presetBy', {
                      author: preset.authorName ?? '—',
                    })}
              </Typography>
            </div>
            {preset.mine && (
              <Button
                variant="secondary"
                size="small"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(preset.id)
                }}
              >
                {t('sdui.menuSettings.presetDelete')}
              </Button>
            )}
            <Button
              size="small"
              disabled={busy}
              onClick={() => {
                onApply(preset.id)
                onClose()
              }}
            >
              {t('sdui.menuSettings.presetApply')}
            </Button>
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          {t('sdui.menuSettings.close')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

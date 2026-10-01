import type { FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import {
  viewSettingsDefaultsHistoryApi,
  type ViewSettingsDefaultsHistoryEntry,
} from '../api/view-settings-defaults-history-api'
import type { ViewSettingsProfile } from '../api/view-settings-profile-defaults-api'

interface ViewSettingsHistoryDialogProps {
  open: boolean
  screenKey: string
  /** Справочник профилей — подпись ролевого слоя вместо технического ключа. */
  profiles: ViewSettingsProfile[] | undefined
  onClose: () => void
}

/**
 * История изменений «формы для всех» (SCRUM-412 п.4): кто и когда сохранял или
 * сбрасывал админский дефолт экрана — общий и пер-ролевые слои. Только чтение;
 * доступно из диалога «Изменить форму для всех» (админ).
 */
export const ViewSettingsHistoryDialog: FC<ViewSettingsHistoryDialogProps> = ({
  open,
  screenKey,
  profiles,
  onClose,
}) => {
  const { t } = useTranslation()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['view-settings-defaults-history', screenKey],
    queryFn: ({ signal }) =>
      viewSettingsDefaultsHistoryApi.list(screenKey, signal),
    enabled: open,
  })

  const layerLabel = (entry: ViewSettingsDefaultsHistoryEntry): string => {
    if (entry.profileKey == null) return t('sdui.customizeForm.historyLayerAll')
    const profile = profiles?.find((p) => p.code === entry.profileKey)
    return t('sdui.customizeForm.historyLayerProfile', {
      name: profile?.name ?? entry.profileKey,
    })
  }

  const actionLabel = (entry: ViewSettingsDefaultsHistoryEntry): string =>
    entry.action === 'RESET'
      ? t('sdui.customizeForm.historyActionReset')
      : t('sdui.customizeForm.historyActionSave', {
          count: entry.entriesCount,
        })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('sdui.customizeForm.historyTitle')}</DialogTitle>
      <DialogContent className="flex flex-col gap-2">
        {isLoading ? (
          <Typography variant="body2">
            {t('sdui.customizeForm.historyLoading')}
          </Typography>
        ) : entries == null || entries.length === 0 ? (
          <Typography variant="body2">
            {t('sdui.customizeForm.historyEmpty')}
          </Typography>
        ) : (
          entries.map((entry, index) => (
            <div
              key={`${entry.savedAt}-${String(index)}`}
              className="flex flex-col gap-1 rounded-md border border-ui-03 p-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <Typography variant="body2" fontWeight={500}>
                  {entry.savedByName ??
                    t('sdui.customizeForm.historyUnknownUser')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(entry.savedAt), 'dd.MM.yyyy HH:mm')}
                </Typography>
              </div>
              <Typography variant="body2" color="text.secondary">
                {layerLabel(entry)} — {actionLabel(entry)}
              </Typography>
            </div>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          {t('sdui.customizeForm.historyClose')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

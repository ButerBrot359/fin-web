import { useMutation, useQueryClient } from '@tanstack/react-query'

import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'
import {
  useCustomizeFormStore,
  type CustomizeFormMode,
} from '../customize-form/customize-form-store'
import type { ViewSettingsLayerApi } from './use-view-settings-layer'

interface UseViewSettingsActionsArgs {
  api: ViewSettingsLayerApi
  mode: CustomizeFormMode
  profile: string
  screenKey: string | null
  close: () => void
}

/**
 * Сохранение/сброс слоя настроек вида. Режим «для всех»: операции НЕ закрывают
 * диалог (решение владельца 15.09) — админ применяет слой, форма под диалогом
 * перерисовывается, и он продолжает настраивать; выходит сам через «Отмена».
 * Личный режим — прежнее поведение: сохранил и закрылся.
 */
export function useViewSettingsActions({
  api,
  mode,
  profile,
  screenKey,
  close,
}: UseViewSettingsActionsArgs): {
  finish: () => Promise<void>
  save: (nextPatch: ViewSettingsPatchEntry[]) => void
  reset: () => void
  busy: boolean
} {
  const queryClient = useQueryClient()

  const finish = async () => {
    if (screenKey != null) {
      await queryClient.invalidateQueries({
        queryKey: ['view-settings'],
      })
    }
    notifyViewSettingsChanged()
    close()
  }

  const applyKeepOpen = async () => {
    // Re-OPEN пересоздаёт SduiScreen (диалог кратко размонтируется), и локальный
    // выбор слоя пересеется из стора — фиксируем там текущий, чтобы не откатился.
    useCustomizeFormStore.setState({ initialProfile: profile })
    await queryClient.invalidateQueries({ queryKey: ['view-settings'] })
    await queryClient.invalidateQueries({
      queryKey: ['view-settings-admin-screens'],
    })
    notifyViewSettingsChanged()
  }

  const saveMutation = useMutation({
    mutationFn: (nextPatch: ViewSettingsPatchEntry[]) =>
      api.put(screenKey ?? '', nextPatch),
    onSuccess: mode === 'default' ? applyKeepOpen : finish,
  })
  const resetMutation = useMutation({
    mutationFn: () => api.reset(screenKey ?? ''),
    onSuccess: mode === 'default' ? applyKeepOpen : finish,
  })

  return {
    finish,
    save: (nextPatch) => {
      saveMutation.mutate(nextPatch)
    },
    reset: () => {
      resetMutation.mutate()
    },
    busy: saveMutation.isPending || resetMutation.isPending,
  }
}

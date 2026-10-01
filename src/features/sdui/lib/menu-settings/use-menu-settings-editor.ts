import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import {
  menuSettingsApi,
  type MenuScope,
  type MenuStructure,
} from '../../api/menu-settings-api'
import {
  buildPatch,
  moveItemTo,
  seedDraft,
  toggleHidden,
  type MenuDraft,
} from './menu-editor-state'

/** Стабильный ключ scope для React Query. */
const scopeKey = (scope: MenuScope): string => {
  switch (scope.kind) {
    case 'profile':
      return `profile:${scope.profileKey}`
    case 'user':
      return `user:${scope.userKey}`
    default:
      return scope.kind
  }
}

/**
 * Состояние редактора меню (SCRUM-426): структура слоя + черновик поверх неё,
 * сохранение/сброс с инвалидацией живого меню. Мерж слоёв делает бэк — после
 * записи сайдбар и открытый SDUI-экран просто перечитываются.
 */
export function useMenuSettingsEditor(scope: MenuScope) {
  const queryClient = useQueryClient()
  const { i18n } = useTranslation()

  const structureQuery = useQuery({
    queryKey: ['menu-structure', scopeKey(scope)],
    queryFn: ({ signal }) => menuSettingsApi.structure(scope, signal),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const structure = structureQuery.data ?? null

  // Черновик привязан к конкретному объекту структуры: пришла новая структура
  // (смена scope, инвалидация) — черновик пересеивается на лету, без эффекта.
  const [edit, setEdit] = useState<{
    base: MenuStructure
    draft: MenuDraft
  } | null>(null)
  const draft: MenuDraft | null =
    structure == null
      ? null
      : edit?.base === structure
        ? edit.draft
        : seedDraft(structure)

  const updateDraft = (updater: (d: MenuDraft) => MenuDraft): void => {
    if (structure == null || draft == null) return
    setEdit({ base: structure, draft: updater(draft) })
  }

  const invalidateMenus = async (): Promise<void> => {
    // Бэк уже отдаёт меню с новыми слоями — достаточно перечитать источники.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['app-shell'] }),
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] }),
      queryClient.invalidateQueries({ queryKey: ['menu-structure'] }),
    ])
    // Открытый SDUI-экран модуля перечитывается re-OPEN'ом через общую шину.
    notifyViewSettingsChanged()
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (structure == null || draft == null) return Promise.resolve()
      return menuSettingsApi.putPatch(scope, buildPatch(structure, draft))
    },
    onSuccess: invalidateMenus,
  })

  const resetMutation = useMutation({
    mutationFn: () => menuSettingsApi.resetPatch(scope),
    onSuccess: invalidateMenus,
  })

  // Применение пресета: его патч целиком замещает ЛИЧНЫЙ слой применившего —
  // чужие настройки и админские уровни не трогаются (решение владельца 25.09).
  const applyPresetMutation = useMutation({
    mutationFn: async (presetId: number) => {
      const patch = await menuSettingsApi.presetPatch(presetId)
      await menuSettingsApi.putPatch({ kind: 'my' }, patch)
    },
    onSuccess: invalidateMenus,
  })

  const busy =
    saveMutation.isPending ||
    resetMutation.isPending ||
    applyPresetMutation.isPending

  return {
    structure,
    draft,
    isLoading: structureQuery.isPending,
    isError: structureQuery.isError,
    busy,
    language: i18n.language,
    toggle: (key: string, effectiveHiddenBelow: boolean) => {
      updateDraft((d) => toggleHidden(d, key, effectiveHiddenBelow))
    },
    moveTo: (parentKey: string, key: string, targetKey: string) => {
      updateDraft((d) => moveItemTo(d, parentKey, key, targetKey))
    },
    save: saveMutation.mutate,
    reset: resetMutation.mutate,
    applyPreset: applyPresetMutation.mutate,
    /** Текущий черновик как патч — для публикации пресета. */
    draftPatch: () =>
      structure == null || draft == null ? {} : buildPatch(structure, draft),
  }
}

export type MenuSettingsEditorState = ReturnType<typeof useMenuSettingsEditor>

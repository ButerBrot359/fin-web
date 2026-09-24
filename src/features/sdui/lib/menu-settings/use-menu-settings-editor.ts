import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import {
  menuSettingsApi,
  type MenuScope,
  type MenuStructure,
} from '../../api/menu-settings-api'
import {
  buildPatch,
  seedDraft,
  toggleHidden,
  moveItem,
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

  const busy = saveMutation.isPending || resetMutation.isPending

  return {
    structure,
    draft,
    isLoading: structureQuery.isPending,
    isError: structureQuery.isError,
    busy,
    toggle: (key: string, effectiveHiddenBelow: boolean) => {
      updateDraft((d) => toggleHidden(d, key, effectiveHiddenBelow))
    },
    move: (parentKey: string, key: string, dir: -1 | 1) => {
      updateDraft((d) => moveItem(d, parentKey, key, dir))
    },
    save: saveMutation.mutate,
    reset: resetMutation.mutate,
  }
}

export type MenuSettingsEditorState = ReturnType<typeof useMenuSettingsEditor>

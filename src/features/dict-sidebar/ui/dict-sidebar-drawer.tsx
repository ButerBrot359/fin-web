import { Drawer } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { cn } from '@/shared/lib/utils/cn'
import { DICT_SIDEBAR_Z } from '@/shared/lib/utils/overlay-z-index'
import { cssVar, palette, semantic } from '@/shared/design/tokens'
import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import { fetchDictTypeMetadata } from '../api/dict-sidebar-api'
import type { DictSidebarPanel } from '../types/dict-sidebar'
import { DictSidebarHeader } from './dict-sidebar-header'
import { DictSidebarListView } from './dict-sidebar-list-view'
import { DictSidebarFormView } from './dict-sidebar-form-view'

/** Renders a single panel's content with its own type-metadata query. */
const PanelContent = ({
  panel,
  isActive,
}: {
  panel: DictSidebarPanel
  isActive: boolean
}) => {
  const { t, i18n } = useTranslation()

  const { data: typeData } = useQuery({
    queryKey: ['dict-sidebar-type', panel.domain, panel.typeCode],
    queryFn: ({ signal }) =>
      fetchDictTypeMetadata(panel.domain, panel.typeCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const typeName = typeData
    ? getLocalizedName(typeData, i18n.language)
    : panel.typeCode

  const title =
    panel.mode === 'create'
      ? t('dictSidebar.createTitle', { name: typeName })
      : panel.mode === 'edit'
        ? (panel.title ?? typeName)
        : typeName

  // Figma side-panel (324:13541): паддинги L/R 40, сверху 60
  return (
    <div
      className={cn(
        'flex h-full flex-col px-10 pt-15 pb-10',
        !isActive && 'hidden'
      )}
    >
      {isActive && <DictSidebarHeader title={title} />}
      {panel.mode === 'list' && <DictSidebarListView panel={panel} />}
      {(panel.mode === 'create' || panel.mode === 'edit') && typeData && (
        <DictSidebarFormView
          panel={panel}
          typeData={typeData}
          typeName={typeName}
        />
      )}
    </div>
  )
}

export const DictSidebarDrawer = () => {
  const { stack, closeAll } = useDictSidebarStore()
  const isOpen = stack.length > 0

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={closeAll}
      // Панель всегда открывается ПОВЕРХ текущего — в том числе из
      // SDUI-панели. Без явного слоя она осталась бы на `zIndex.drawer` (1200)
      // и уехала бы под полноэкранную панель (`zIndex.modal`, 1300).
      style={{ zIndex: DICT_SIDEBAR_Z }}
      slotProps={{
        paper: {
          sx: {
            // Figma side-panel (324:13541): ширина 766
            width: 766,
            borderTopLeftRadius: 40,
            borderBottomLeftRadius: 40,
            backgroundColor: cssVar(palette.ui02),
            overflow: 'hidden',
          },
        },
        backdrop: {
          sx: { backgroundColor: cssVar(semantic.backdrop) },
        },
      }}
    >
      {stack.map((panel, i) => (
        <PanelContent
          key={panel.id}
          panel={panel}
          isActive={i === stack.length - 1}
        />
      ))}
    </Drawer>
  )
}

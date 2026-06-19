import { Drawer } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { cn } from '@/shared/lib/utils/cn'
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
    : (panel.typeCode ?? '')

  const title =
    panel.mode === 'create'
      ? t('dictSidebar.createTitle', { name: typeName })
      : panel.mode === 'edit'
        ? (panel.title ?? typeName)
        : typeName

  return (
    <div className={cn('flex h-full flex-col p-7', !isActive && 'hidden')}>
      {isActive && <DictSidebarHeader title={title} />}
      {panel.mode === 'list' && <DictSidebarListView panel={panel} />}
      {(panel.mode === 'create' || panel.mode === 'edit') &&
        typeData && (
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
      slotProps={{
        paper: {
          sx: {
            width: 900,
            borderTopLeftRadius: 40,
            borderBottomLeftRadius: 40,
            backgroundColor: '#F2F6FD',
            overflow: 'hidden',
          },
        },
        backdrop: {
          sx: { backgroundColor: 'rgba(34, 33, 36, 0.6)' },
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

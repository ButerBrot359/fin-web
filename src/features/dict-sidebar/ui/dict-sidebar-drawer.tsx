import { Drawer } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import { fetchDictTypeMetadata } from '../api/dict-sidebar-api'
import { DictSidebarHeader } from './dict-sidebar-header'
import { DictSidebarListView } from './dict-sidebar-list-view'
import { DictSidebarFormView } from './dict-sidebar-form-view'

export const DictSidebarDrawer = () => {
  const { t, i18n } = useTranslation()
  const { stack, closeAll } = useDictSidebarStore()
  const isOpen = stack.length > 0
  const topPanel = stack[stack.length - 1] as (typeof stack)[number] | undefined

  const { data: typeData } = useQuery({
    queryKey: ['dict-sidebar-type', topPanel?.domain, topPanel?.typeCode],
    queryFn: ({ signal }) =>
      fetchDictTypeMetadata(topPanel!.domain, topPanel!.typeCode, signal),
    enabled: !!topPanel,
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const typeName = typeData
    ? getLocalizedName(typeData, i18n.language)
    : (topPanel?.typeCode ?? '')

  const title =
    topPanel?.mode === 'create'
      ? t('dictSidebar.createTitle', { name: typeName })
      : topPanel?.mode === 'edit'
        ? (topPanel.title ?? typeName)
        : typeName

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
      {topPanel && (
        <div className="flex h-full flex-col p-7">
          <DictSidebarHeader title={title} />
          {topPanel.mode === 'list' && <DictSidebarListView panel={topPanel} />}
          {(topPanel.mode === 'create' || topPanel.mode === 'edit') &&
            typeData && (
              <DictSidebarFormView
                panel={topPanel}
                typeData={typeData}
                typeName={typeName}
              />
            )}
        </div>
      )}
    </Drawer>
  )
}

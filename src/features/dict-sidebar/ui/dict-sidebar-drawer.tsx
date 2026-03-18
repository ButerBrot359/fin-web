import { Drawer } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import { fetchDictTypeMetadata } from '../api/dict-sidebar-api'
import { DictSidebarHeader } from './dict-sidebar-header'
import { DictSidebarListView } from './dict-sidebar-list-view'

export const DictSidebarDrawer = () => {
  const { i18n } = useTranslation()
  const { stack, closeAll } = useDictSidebarStore()
  const isOpen = stack.length > 0
  const topPanel = stack[stack.length - 1] as (typeof stack)[number] | undefined

  const { data: typeData } = useQuery({
    queryKey: ['dict-sidebar-type', topPanel?.dataType, topPanel?.typeCode],
    queryFn: ({ signal }) =>
      fetchDictTypeMetadata(topPanel!.dataType, topPanel!.typeCode, signal),
    enabled: !!topPanel,
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data,
  })

  const title = typeData
    ? i18n.language === 'kz'
      ? typeData.nameKz || typeData.nameRu
      : typeData.nameRu
    : (topPanel?.typeCode ?? '')

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
        </div>
      )}
    </Drawer>
  )
}

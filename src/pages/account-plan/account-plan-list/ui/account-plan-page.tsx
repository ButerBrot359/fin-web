import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAccountPlanList } from '@/entities/account-plan'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { AccountPlanListToolbar } from '@/widgets/account-plan-list-toolbar'

import { useAccountPlanColumns } from '../lib/hooks/use-account-plan-columns'
import { useExpandedNodesStore } from '../lib/hooks/use-expanded-nodes-store'
import {
  buildTreeRows,
  filterTreeByQuery,
  type AccountPlanRow,
} from '../lib/utils/build-tree-rows'
import { AccountPlanTreeTable } from './account-plan-tree-table'

export const AccountPlanPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode = '', moduleCode = '' } = useParams()

  const [search, setSearch] = useState('')

  const treeStore = useExpandedNodesStore()
  const expandedIds = treeStore.getExpanded(location.pathname)
  const selectedId = treeStore.getSelected(location.pathname)

  const toggleExpand = (id: number) => {
    treeStore.toggle(location.pathname, id)
  }

  // План счетов всегда грузится целиком — это сотни записей, не миллионы;
  // дерево строится клиентом, как в 1С Конфигуратор. moduleCode из URL
  // — это typeCode плана счетов (EdiniyPlanSchetovGosUchrezhdeniya).
  const { entries, isLoading } = useAccountPlanList({
    typeCode: moduleCode || undefined,
    parent: null,
    enabled: !!moduleCode,
  })

  useTabMeta(t('accountPlan.title'))

  const filtered = useMemo(
    () => filterTreeByQuery(entries, search),
    [entries, search]
  )

  const rows = useMemo(
    () => buildTreeRows(filtered, expandedIds),
    [filtered, expandedIds]
  )

  const columns = useAccountPlanColumns({ onToggleExpand: toggleExpand })

  // Открыть карточку записи (не папки) — навигация на страницу счёта.
  const openEntry = (row: AccountPlanRow) => {
    if (row.entry.isGroup) return
    void navigate(
      `/modules/${pageCode}/accountplan/${moduleCode}/${String(row.entry.id)}`
    )
  }

  // Ручное определение двойного клика: нативный onDoubleClick ненадёжен —
  // ресайз колонок (columnResizeMode:'onChange') вызывает ре-рендеры, и первый
  // onClick «съедает» dblclick. Поэтому ловим два клика по одной строке вручную.
  const lastClickRef = useRef<{ id: number; time: number } | null>(null)

  const handleRowClick = (row: AccountPlanRow) => {
    const now = Date.now()
    const prev = lastClickRef.current
    if (prev && prev.id === row.entry.id && now - prev.time < 350) {
      lastClickRef.current = null
      openEntry(row)
      return
    }
    lastClickRef.current = { id: row.entry.id, time: now }
    treeStore.setSelected(location.pathname, row.entry.id)
    // Папку раскрываем/сворачиваем одним кликом; запись одним кликом только
    // выделяется, открывается двойным (см. выше).
    if (row.entry.isGroup || row.hasChildren) {
      toggleExpand(row.entry.id)
    }
  }

  // Нативный двойной клик оставляем как резерв (если сработает раньше ручного).
  const handleRowDoubleClick = (row: AccountPlanRow) => {
    openEntry(row)
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={t('accountPlan.title')} onClose={handleClose} />
      <AccountPlanListToolbar
        selectedId={selectedId}
        searchValue={search}
        onSearchChange={setSearch}
      />
      <AccountPlanTreeTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        selectedId={selectedId}
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
      />
    </div>
  )
}

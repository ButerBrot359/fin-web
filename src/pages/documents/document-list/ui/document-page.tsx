import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'
import { useDocumentColumnsMeta } from '@/entities/document-entry'
import {
  ActiveFiltersBar,
  isFilterableDocumentType,
  useFilterUrlSync,
} from '@/features/table-filter'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DocumentListToolbar } from '@/widgets/document-list-toolbar'

import { DocumentTable } from './document-table'

export const DocumentPage = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { moduleCode = '', pageCode = '' } = useParams()
  const { title, attributes } = useDocumentType(moduleCode)
  useTabMeta(title)

  const filterEnabled = isFilterableDocumentType(moduleCode)
  const filterTableId = filterEnabled ? moduleCode : undefined
  const { columns: columnsMeta } = useDocumentColumnsMeta(
    filterEnabled ? moduleCode : ''
  )

  useFilterUrlSync(filterTableId)

  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [selectedRowName, setSelectedRowName] = useState<string | null>(null)

  const handleSelectRow = (id: number, name: string) => {
    setSelectedRowId(id)
    setSelectedRowName(name)
  }

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  return (
    <div className="flex flex-col gap-5 pt-5 h-full">
      <PageHeader title={title} onClose={handleClose} />
      <DocumentListToolbar
        selectedRowId={selectedRowId}
        selectedRowName={selectedRowName}
      />
      {filterTableId && (
        <ActiveFiltersBar tableId={filterTableId} columns={columnsMeta} />
      )}
      <DocumentTable
        attributes={attributes}
        selectedRowId={selectedRowId}
        onSelectRow={handleSelectRow}
        filterTableId={filterTableId}
        columnsMeta={filterEnabled ? columnsMeta : undefined}
      />
    </div>
  )
}

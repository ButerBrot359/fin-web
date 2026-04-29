import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DictionaryListToolbar } from '@/widgets/dictionary-list-toolbar'

import { useDictionaryType } from '../lib/hooks/use-dictionary-type'
import { DictionaryTable } from './dictionary-table'

export const DictionaryPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search)
  )
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  const skipDependsOn = searchParams.get('skipDependsOn') === 'true'

  const { title, attributes, isLoading } = useDictionaryType(domain, moduleCode)
  useTabMeta(title)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}`)
  }

  if (isLoading) return null

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />
      <DictionaryListToolbar selectedRowId={selectedRowId} domain={domain} />
      <DictionaryTable
        attributes={attributes}
        selectedRowId={selectedRowId}
        onSelectRow={setSelectedRowId}
        domain={domain}
        skipDependsOn={skipDependsOn}
      />
    </div>
  )
}

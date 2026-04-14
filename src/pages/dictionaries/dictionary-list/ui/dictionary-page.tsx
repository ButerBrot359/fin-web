import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/widgets/page-header'
import { DictionaryListToolbar } from '@/widgets/dictionary-list-toolbar'

import { useDictionaryType } from '../lib/hooks/use-dictionary-type'
import { DictionaryTable } from './dictionary-table'

export const DictionaryPage = () => {
  const navigate = useNavigate()
  const { moduleCode = '', pageCode = '' } = useParams()
  const [domain] = useState(
    () =>
      new URLSearchParams(window.location.search).get('domain') ?? 'DICTIONARY'
  )

  const { title, attributes, isLoading } = useDictionaryType(domain, moduleCode)
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)

  const handleClose = () => {
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
      />
    </div>
  )
}

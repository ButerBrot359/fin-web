import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

interface DictionaryListToolbarProps {
  selectedRowId?: number | null
  domain: string
}

export const DictionaryListToolbar = ({
  selectedRowId,
  domain,
}: DictionaryListToolbarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode, moduleCode } = useParams()
  const [search, setSearch] = useState('')

  const handleCreate = () => {
    if (!pageCode || !moduleCode) return
    void navigate(
      `/modules/${pageCode}/dictionary/${moduleCode}/new?domain=${domain}`
    )
  }

  return (
    <div className="flex items-center justify-between pb-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={handleCreate}>
          {t('actions.create')}
        </Button>
        <Button variant="secondary" disabled={selectedRowId == null}>
          {t('documentListToolbar.editSelected')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t('pageToolbar.search')}
          value={search}
          className="w-64 bg-ui-01"
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
        <DropdownButton label={t('documentListToolbar.more')} />
      </div>
    </div>
  )
}

import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import CopyDocIcon from '@/shared/assets/icons/copy-doc.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

interface AccountPlanListToolbarProps {
  selectedId?: number | null
  searchValue: string
  onSearchChange: (value: string) => void
}

export const AccountPlanListToolbar = ({
  selectedId,
  searchValue,
  onSearchChange,
}: AccountPlanListToolbarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '', moduleCode = '' } = useParams()

  const handleCreate = () => {
    if (!pageCode || !moduleCode) return
    void navigate(`/modules/${pageCode}/accountplan/${moduleCode}/new`)
  }

  const handleEdit = () => {
    if (selectedId == null) return
    void navigate(
      `/modules/${pageCode}/accountplan/${moduleCode}/${String(selectedId)}`
    )
  }

  return (
    <div className="flex items-center justify-between pb-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={handleCreate}>
          {t('actions.create')}
        </Button>
        <Button
          variant="secondary"
          disabled={selectedId == null}
          onClick={handleEdit}
        >
          {t('documentListToolbar.editSelected')}
        </Button>
        <Button
          variant="secondary"
          aria-label={t('actions.copy')}
          disabled={selectedId == null}
          startIcon={<CopyDocIcon className="h-5 w-5" />}
          onClick={() => {
            if (selectedId == null) return
            void navigate(
              `/modules/${pageCode}/accountplan/${moduleCode}/new?copyFrom=${String(selectedId)}`
            )
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t('pageToolbar.search')}
          value={searchValue}
          className="w-64 bg-ui-01"
          onChange={(e) => {
            onSearchChange(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
        <DropdownButton label={t('documentListToolbar.more')} />
      </div>
    </div>
  )
}

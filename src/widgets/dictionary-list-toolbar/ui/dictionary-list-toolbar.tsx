import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import CopyDocIcon from '@/shared/assets/icons/copy-doc.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

interface DictionaryListToolbarProps {
  selectedRowId?: number | null
  domain: string
  isHierarchical?: boolean
  onCreateGroup?: () => void
  // SCRUM-360 §2: поиск контролируется страницей — значение уходит в
  // FilterRequest.q (по образцу account-plan-list-toolbar).
  searchValue: string
  onSearchChange: (value: string) => void
}

export const DictionaryListToolbar = ({
  selectedRowId,
  domain,
  isHierarchical,
  onCreateGroup,
  searchValue,
  onSearchChange,
}: DictionaryListToolbarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '', moduleCode = '' } = useParams()

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
        {isHierarchical && (
          <Button variant="secondary" onClick={onCreateGroup}>
            {t('actions.createGroup')}
          </Button>
        )}
        <Button variant="secondary" disabled={selectedRowId == null}>
          {t('documentListToolbar.editSelected')}
        </Button>
        <Button
          variant="secondary"
          aria-label={t('actions.copy')}
          disabled={selectedRowId == null}
          startIcon={<CopyDocIcon className="h-5 w-5" />}
          onClick={() =>
            void navigate(
              `/modules/${pageCode}/dictionary/${moduleCode}/new?domain=${domain}&copyFrom=${String(selectedRowId)}`
            )
          }
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

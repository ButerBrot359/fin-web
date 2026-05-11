import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'
import { showToast } from '@/shared/ui/toast/show-toast'
import { copyDictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'

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

  const queryClient = useQueryClient()

  const copyMutation = useMutation({
    mutationFn: (id: number) => copyDictEntry(domain, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['dict-entries', domain, moduleCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dict-sidebar-entries', domain, moduleCode],
      })
      void queryClient.invalidateQueries({
        queryKey: ['dictionary-search'],
      })
      showToast('success', t('actions.copied'))
    },
    onError: () => {
      showToast('error', t('actions.copyError'))
    },
  })

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
        <Button
          variant="secondary"
          disabled={selectedRowId == null || copyMutation.isPending}
          onClick={() => copyMutation.mutate(selectedRowId!)}
        >
          {t('actions.copy')}
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

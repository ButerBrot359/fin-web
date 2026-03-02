import { useState } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import AddDocumentIcon from '@/shared/assets/icons/add-document.svg'
import DebetKreditIcon from '@/shared/assets/icons/debet-kredit.svg'
import LayersIcon from '@/shared/assets/icons/layers.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import {
  GreenAccentButton,
  DropdownButton,
  IconButtonWrapper,
} from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

export const DocumentListToolbar = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  return (
    <div className="flex items-center justify-between border-b border-accent-01 pb-3">
      <div className="flex items-center gap-2">
        <GreenAccentButton sx={{ textTransform: 'none' }}>
          <Typography variant="body2"> {t('actions.create')}</Typography>
        </GreenAccentButton>

        <div className="flex items-center gap-2">
          <IconButtonWrapper ariaLabel={t('actions.create')}>
            <AddDocumentIcon className="h-5 w-5" />
          </IconButtonWrapper>
          <IconButtonWrapper ariaLabel="Дт/Кт">
            <DebetKreditIcon className="h-5 w-5" />
          </IconButtonWrapper>
          <IconButtonWrapper ariaLabel="Layers">
            <LayersIcon className="h-5 w-5" />
          </IconButtonWrapper>
        </div>

        <Typography
          variant="body2"
          className="cursor-pointer whitespace-nowrap p-2.5 text-ui-05 rounded-md bg-ui-01 hover:bg-ui-01/60"
        >
          {t('documentListToolbar.editSelected')}
        </Typography>

        <DropdownButton label={t('documentListToolbar.print')} />
        <DropdownButton label={t('documentListToolbar.reports')} />
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

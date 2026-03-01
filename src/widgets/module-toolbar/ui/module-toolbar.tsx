import { useState } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import SearchIcon from '@/shared/assets/icons/search.svg'
import GearIcon from '@/shared/assets/icons/gear.svg'
import CrossIcon from '@/shared/assets/icons/cross.svg'
import { SearchInput } from '@/shared/ui/inputs'

interface ModuleToolbarProps {
  title: string
}

export const ModuleToolbar = ({ title }: ModuleToolbarProps) => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  return (
    <div className="flex items-center justify-between">
      <Typography variant="h5" fontWeight={600}>
        {title}
      </Typography>

      <div className="flex gap-1">
        <SearchInput
          placeholder={t('pageToolbar.search')}
          value={search}
          className="bg-ui-01 w-81.5"
          onChange={(e) => {
            setSearch(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Settings"
            className="w-10 h-10 flex justify-center items-center"
          >
            <GearIcon />
          </button>
          <button
            type="button"
            aria-label="Close"
            className="w-10 h-10 flex justify-center items-center"
          >
            <CrossIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

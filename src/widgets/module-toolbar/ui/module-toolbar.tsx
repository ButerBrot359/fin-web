import { useState } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import SearchIcon from '@/shared/assets/icons/search.svg'
import GearIcon from '@/shared/assets/icons/gear.svg'
import CrossIcon from '@/shared/assets/icons/cross.svg'
import { SearchInput } from '@/shared/ui/inputs'
import { Button } from '@/shared/ui/buttons'

interface ModuleToolbarProps {
  title: string
  onClose?: () => void
}

export const ModuleToolbar = ({ title, onClose }: ModuleToolbarProps) => {
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
          <Button
            variant="tertiary"
            aria-label="Settings"
            startIcon={<GearIcon />}
          />
          <Button
            variant="tertiary"
            aria-label="Close"
            onClick={onClose}
            startIcon={<CrossIcon />}
          />
        </div>
      </div>
    </div>
  )
}

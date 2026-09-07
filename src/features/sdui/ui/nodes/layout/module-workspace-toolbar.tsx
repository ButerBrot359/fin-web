import { useState, type FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import SearchIcon from '@/shared/assets/icons/search.svg'
import GearIcon from '@/shared/assets/icons/gear.svg'
import CrossIcon from '@/shared/assets/icons/cross.svg'
import { SearchInput } from '@/shared/ui/inputs'
import { Button } from '@/shared/ui/buttons'

import type { NodeProps } from '../../../types/view'

// SCRUM-181 v3: TOOLBAR(variant module-workspace) — серверный заголовок модуля
// и локальное закрытие по props.route. Поиск и шестерёнка — клиентские
// презентационные контролы (как в легаси-тулбаре модуля): дерево не меняют и
// действий в /api/view не шлют.
export const ModuleWorkspaceToolbar: FC<NodeProps> = ({ node }) => {
  const title = (node.props?.title as string | undefined) ?? ''
  const closeRoute = (node.props?.route as string | undefined) ?? '/'
  const { t } = useTranslation()
  const navigate = useNavigate()
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
            aria-label={t('actions.settings')}
            startIcon={<GearIcon />}
          />
          <Button
            variant="tertiary"
            aria-label={t('actions.close')}
            onClick={() => {
              void navigate(closeRoute)
            }}
            startIcon={<CrossIcon />}
          />
        </div>
      </div>
    </div>
  )
}

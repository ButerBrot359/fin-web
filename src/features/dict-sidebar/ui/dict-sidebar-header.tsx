import { IconButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'

import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'

interface DictSidebarHeaderProps {
  title: string
}

export const DictSidebarHeader = ({ title }: DictSidebarHeaderProps) => {
  const { stack, pop, closeAll } = useDictSidebarStore()
  const showBack = stack.length > 1

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {showBack && (
          <IconButton onClick={pop}>
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, fontSize: 26, color: '#222124' }}
        >
          {title}
        </Typography>
      </div>
      <IconButton onClick={closeAll}>
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </div>
  )
}

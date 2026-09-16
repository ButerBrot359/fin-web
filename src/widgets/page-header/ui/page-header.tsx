import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, Popover, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { FavoriteButton } from '@/features/favorite-button'
import { InterfaceScaleSection } from '@/features/interface-scale'
import { NavigationButtons } from '@/features/navigation-buttons'
import { cssVar, shadows } from '@/shared/design/tokens'
import { showToast } from '@/shared/ui/toast/show-toast'
import LinkIcon from '@/shared/assets/icons/link.svg'
import DotsIcon from '@/shared/assets/icons/dots.svg'
import CrossIcon from '@/shared/assets/icons/cross.svg'

interface PageHeaderProps {
  title: string
  onClose?: () => void
  onBack?: () => void
}

export const PageHeader = ({ title, onClose, onBack }: PageHeaderProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      void navigate(-1)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showToast('info', t('actions.linkCopied'))
    } catch {
      showToast('error', t('actions.copyError'))
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <NavigationButtons onBack={onBack} />
        <FavoriteButton />

        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
      </div>

      <div className="flex items-center">
        <IconButton
          aria-label={t('actions.link')}
          onClick={() => {
            void handleCopyLink()
          }}
        >
          <LinkIcon className="h-5 w-5" />
        </IconButton>
        <IconButton
          aria-label={t('actions.more')}
          onClick={(event) => {
            setMenuAnchor(event.currentTarget)
          }}
        >
          <DotsIcon className="h-5 w-5" />
        </IconButton>
        <IconButton aria-label={t('actions.close')} onClick={handleClose}>
          <CrossIcon className="h-5 w-5" />
        </IconButton>
      </div>

      <Popover
        open={menuAnchor !== null}
        anchorEl={menuAnchor}
        onClose={() => {
          setMenuAnchor(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '24px',
              boxShadow: cssVar(shadows.popup),
              minWidth: 280,
              p: 3,
            },
          },
        }}
      >
        <InterfaceScaleSection />
      </Popover>
    </div>
  )
}

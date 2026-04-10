import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircularProgress, Popover, Typography } from '@mui/material'
import Close from '@mui/icons-material/Close'

import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'
import { cn } from '@/shared/lib/utils/cn'

interface PrintDropdownButtonProps {
  nameRu: string
  nameKz: string
  disabled?: boolean
  loading?: boolean
  onPrint?: (language?: string) => void
}

export const PrintDropdownButton = ({
  nameRu,
  nameKz,
  disabled,
  loading,
  onPrint,
}: PrintDropdownButtonProps) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const open = Boolean(anchorEl)

  const isDisabled = disabled || loading

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return
    setAnchorEl((prev) => (prev ? null : event.currentTarget))
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelect = (language?: string) => {
    onPrint?.(language)
    setAnchorEl(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isDisabled}
        className={cn(
          'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none',
          open
            ? 'bg-accent-02 text-white hover:shadow-md hover:brightness-110 active:brightness-90 active:shadow-none disabled:hover:bg-accent-02 disabled:hover:brightness-100'
            : 'bg-ui-01 text-ui-06 hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none disabled:hover:bg-ui-01 disabled:hover:text-ui-06'
        )}
      >
        <Typography variant="body2">
          {t('documentFormToolbar.print')}
        </Typography>
        {loading ? (
          <CircularProgress size={12} color="inherit" />
        ) : open ? (
          <Close sx={{ fontSize: 14 }} />
        ) : (
          <ArrowDownIcon className="h-2 w-3" />
        )}
      </button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
              borderRadius: '20px',
              overflow: 'hidden',
            },
          },
        }}
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              handleSelect(undefined)
            }}
            className="cursor-pointer border-b border-ui-03 px-4 py-2.5 text-left transition-colors hover:bg-ui-04 active:bg-ui-03"
          >
            <Typography variant="body1">{nameRu}</Typography>
          </button>
          <button
            type="button"
            onClick={() => {
              handleSelect('Kz')
            }}
            className="cursor-pointer px-4 py-2.5 text-left transition-colors hover:bg-ui-04 active:bg-ui-03"
          >
            <Typography variant="body1">
              {nameKz} ({t('documentFormToolbar.kazSuffix')})
            </Typography>
          </button>
        </div>
      </Popover>
    </>
  )
}

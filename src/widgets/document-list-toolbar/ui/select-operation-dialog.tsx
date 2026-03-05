import { useState } from 'react'
import { Dialog, RadioGroup, FormControlLabel, Radio } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'

import type { EnumsValue } from '@/entities/document-type'

interface SelectOperationDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (operationCode: string) => void
  operations: EnumsValue[]
  isLoading: boolean
}

export const SelectOperationDialog = ({
  open,
  onClose,
  onSelect,
  operations,
  isLoading,
}: SelectOperationDialogProps) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState('')

  const handleNext = () => {
    if (selected) {
      onSelect(selected)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onTransitionEnter={() => {
        setSelected('')
      }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
            p: 0,
            m: 0,
            minWidth: 560,
            maxWidth: 'none',
          },
        },
      }}
    >
      <div className="flex flex-col gap-8 px-15 py-10">
        {/* Header */}
        <div className="flex items-center gap-6 w-full">
          <h2 className="flex-1 text-[26px] font-bold text-ui-06 leading-normal">
            {t('selectOperationDialog.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer"
          >
            <CloseIcon sx={{ fontSize: 20, color: '#222124' }} />
          </button>
        </div>

        {/* Radio list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-ui-05">
            ...
          </div>
        ) : (
          <RadioGroup
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
            }}
            sx={{ gap: '16px' }}
          >
            {operations.map((op) => (
              <FormControlLabel
                key={op.code}
                value={op.code}
                sx={{ m: 0, gap: '10px' }}
                control={
                  <Radio
                    disableRipple
                    sx={{
                      p: 0,
                      color: '#222124',
                      transition: 'none',
                      '&.Mui-checked': {
                        color: '#DAF449',
                        transition: 'none',
                      },
                      '&:hover': { bgcolor: 'transparent' },
                      '& .MuiSvgIcon-root': { fontSize: 24 },
                    }}
                  />
                }
                label={
                  <span className="text-base font-medium text-ui-06 leading-normal whitespace-nowrap">
                    {op.name}
                  </span>
                }
              />
            ))}
          </RadioGroup>
        )}

        {/* Buttons */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={handleNext}
            disabled={!selected}
            className="flex-1 cursor-pointer rounded-lg bg-accent-01 px-4 py-2.5 text-base font-medium text-ui-06 leading-normal disabled:opacity-50"
          >
            {t('selectOperationDialog.next')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg bg-white px-4 py-2.5 text-base font-medium text-ui-06 leading-normal"
          >
            {t('actions.cancel')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

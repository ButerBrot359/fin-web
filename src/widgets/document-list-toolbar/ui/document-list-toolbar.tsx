import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
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
import { SelectOperationDialog } from './select-operation-dialog'

interface EnumsValue {
  id: number
  code: string
  code1C: string
  name: string
  enumCode: string
  isActive: boolean
}

interface OnGetFormField {
  fieldName: string
  elements: EnumsValue[]
}

export const DocumentListToolbar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode, moduleCode } = useParams()
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [operations, setOperations] = useState<EnumsValue[]>([])
  const [isLoadingOperations, setIsLoadingOperations] = useState(false)

  const handleCreate = async () => {
    if (!pageCode || !moduleCode) return

    setIsLoadingOperations(true)
    setDialogOpen(true)

    try {
      const response = await apiService.get<
        ApiResponse<OnGetFormField | OnGetFormField[]>
      >({
        url: `/api/document-types/${moduleCode}/on-get-form`,
      })
      const formData = response.data.data

      const fields: OnGetFormField[] = Array.isArray(formData)
        ? formData
        : [formData]
      const vidOperatsii = fields.find((f) => f.fieldName === 'VidOperatsii')

      if (vidOperatsii && vidOperatsii.elements.length > 0) {
        setOperations(vidOperatsii.elements)
      } else {
        setDialogOpen(false)
        void navigate(`/modules/${pageCode}/document/${moduleCode}/new`)
      }
    } catch {
      setDialogOpen(false)
      void navigate(`/modules/${pageCode}/document/${moduleCode}/new`)
    } finally {
      setIsLoadingOperations(false)
    }
  }

  const handleSelectOperation = (operationCode: string) => {
    if (!pageCode || !moduleCode) return
    setDialogOpen(false)
    void navigate(
      `/modules/${pageCode}/document/${moduleCode}/new?VidOperatsii=${operationCode}`
    )
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setOperations([])
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <GreenAccentButton
            onClick={handleCreate}
            sx={{ textTransform: 'none' }}
          >
            <Typography variant="body2"> {t('actions.create')}</Typography>
          </GreenAccentButton>

          <div className="flex items-center gap-2">
            <IconButtonWrapper ariaLabel={t('actions.create')}>
              <AddDocumentIcon className="h-5 w-5" />
            </IconButtonWrapper>
            <IconButtonWrapper ariaLabel={t('actions.debitCredit')}>
              <DebetKreditIcon className="h-5 w-5" />
            </IconButtonWrapper>
            <IconButtonWrapper ariaLabel={t('actions.layers')}>
              <LayersIcon className="h-5 w-5" />
            </IconButtonWrapper>
          </div>

          <Typography
            variant="body2"
            className="cursor-pointer whitespace-nowrap p-2.5 text-ui-05 rounded-md bg-ui-01 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none"
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

      <SelectOperationDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSelect={handleSelectOperation}
        operations={operations}
        isLoading={isLoadingOperations}
      />
    </>
  )
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { unpostDocumentEntry } from '@/entities/document-entry'
import { openMovementsForEntry } from '@/features/sdui'
import { showToast } from '@/shared/ui/toast/show-toast'

import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
import CopyDocIcon from '@/shared/assets/icons/copy-doc.svg'
import DebetKreditIcon from '@/shared/assets/icons/debet-kredit.svg'
import LayersIcon from '@/shared/assets/icons/layers.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

import { useDocumentEntryPrint } from '@/entities/document-entry'
import { PrintDropdownButton } from '@/widgets/document-form-toolbar'

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

interface DocumentListToolbarProps {
  selectedRowId?: number | null
}

export const DocumentListToolbar = ({
  selectedRowId,
}: DocumentListToolbarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '', moduleCode = '' } = useParams()
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [operations, setOperations] = useState<EnumsValue[]>([])
  const [isLoadingOperations, setIsLoadingOperations] = useState(false)

  const { printCommands, handlePrint, isPrintLoading } = useDocumentEntryPrint(
    moduleCode,
    selectedRowId ?? undefined
  )

  const queryClient = useQueryClient()

  const unpostMutation = useMutation({
    mutationFn: (id: number) => unpostDocumentEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
      showToast('success', t('documentListToolbar.unpostSuccess'))
    },
    onError: () => {
      showToast('error', t('documentListToolbar.unpostError'))
    },
  })

  // ДтКт: движения открываются SDUI workspace-вкладкой (паритет с формой),
  // legacy-роут .../movements больше не используется.
  const movementsMutation = useMutation({
    mutationFn: (id: number) => openMovementsForEntry(String(id)),
    onError: () => {
      showToast('error', t('documentListToolbar.movementsError'))
    },
  })

  const handleCreate = async () => {
    if (!pageCode || !moduleCode) return

    // Диалог выбора вида операции открываем ТОЛЬКО после того, как узнали, что виды
    // операции реально есть. Раньше он открывался оптимистично (до ответа on-get-form),
    // и для документов без видов операции (например, «Заявка на регистрацию ГП сделки»)
    // окно мелькало и тут же закрывалось.
    setIsLoadingOperations(true)

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
        setDialogOpen(true)
      } else {
        void navigate(`/modules/${pageCode}/document/${moduleCode}/new`)
      }
    } catch {
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

  const handleMovements = () => {
    if (selectedRowId == null) return
    movementsMutation.mutate(selectedRowId)
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleCreate}>
            {t('actions.create')}
          </Button>

          <Button
            variant="secondary"
            aria-label={t('actions.copy')}
            disabled={selectedRowId == null}
            startIcon={<CopyDocIcon className="h-5 w-5" />}
            onClick={() =>
              void navigate(
                `/modules/${pageCode}/document/${moduleCode}/new?copyFrom=${String(selectedRowId)}`
              )
            }
          />

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              aria-label={t('actions.debitCredit')}
              startIcon={<DebetKreditIcon className="h-5 w-5" />}
              disabled={selectedRowId == null || movementsMutation.isPending}
              onClick={handleMovements}
            />
            <Button
              variant="secondary"
              aria-label={t('actions.layers')}
              startIcon={<LayersIcon className="h-5 w-5" />}
            />
          </div>

          <Button
            variant="secondary"
            disabled={selectedRowId == null || unpostMutation.isPending}
            onClick={() => {
              if (selectedRowId) unpostMutation.mutate(selectedRowId)
            }}
          >
            {t('documentListToolbar.unpost')}
          </Button>

          <PrintDropdownButton
            commands={printCommands}
            disabled={selectedRowId == null}
            loading={isPrintLoading}
            onPrint={handlePrint}
          />
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

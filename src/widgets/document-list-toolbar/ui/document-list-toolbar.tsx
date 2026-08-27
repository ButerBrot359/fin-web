import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import type { DocumentEntry } from '@/entities/document-entry'
import { useDocumentType } from '@/entities/document-type'

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

import { useToolbarMutations } from '../lib/hooks/use-toolbar-mutations'
import { SelectOperationDialog } from './select-operation-dialog'
import { TabelBulkEditButton } from './tabel-bulk-edit-dialog'
import { TabelMoreDropdown, TabelReportsDropdown } from './tabel-toolbar-menus'

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

// SCRUM-276 spec v2 §3.3: Tabel-режим тулбара — команды по числу выбранных
// строк. Прочие document types проп не передают и не меняют поведения.
export interface TabelToolbarState {
  selectedIds: number[]
  /** Ровно одна выбранная строка — или null (для команд «ровно 1»). */
  selectedEntry: DocumentEntry | null
  hasCriteria: boolean
  onRefresh: () => void
  onCancelSearch: () => void
}

interface DocumentListToolbarProps {
  selectedRowId?: number | null
  // SCRUM-360 §2: поиск контролируется страницей — значение уходит в
  // FilterRequest.q (по образцу account-plan-list-toolbar).
  searchValue: string
  onSearchChange: (value: string) => void
  tabel?: TabelToolbarState
}

export const DocumentListToolbar = ({
  selectedRowId,
  searchValue,
  onSearchChange,
  tabel,
}: DocumentListToolbarProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pageCode = '', moduleCode = '' } = useParams()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [operations, setOperations] = useState<EnumsValue[]>([])
  const [isLoadingOperations, setIsLoadingOperations] = useState(false)

  const { printCommands, handlePrint, isPrintLoading } = useDocumentEntryPrint(
    moduleCode,
    selectedRowId ?? undefined
  )

  // 1С: у формы списка исключены Create/Copy (например «Прием на работу (списком)»).
  // Тип уже в suspense-кеше — страница списка грузит его тем же ключом (SCRUM-265 FE-4).
  const { interactiveCreationForbidden } = useDocumentType(moduleCode)

  const { unpost: unpostMutation, movements: movementsMutation } =
    useToolbarMutations()

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
          {!interactiveCreationForbidden && (
            <Button variant="primary" onClick={handleCreate}>
              {t('actions.create')}
            </Button>
          )}

          {!interactiveCreationForbidden && (
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
          )}

          {/* SCRUM-276 §3.2/§3.3: у Табеля вне 1С-эталона нет ДтКт-иконки,
              «Слоёв» и отдельной кнопки отмены проведения — проведение живёт
              в «Ещё», движения — в «Отчётах» */}
          {!tabel && (
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
          )}

          {!tabel && (
            <Button
              variant="secondary"
              disabled={selectedRowId == null || unpostMutation.isPending}
              onClick={() => {
                if (selectedRowId) unpostMutation.mutate(selectedRowId)
              }}
            >
              {t('documentListToolbar.unpost')}
            </Button>
          )}

          {tabel && (
            <TabelBulkEditButton
              typeCode={moduleCode}
              selectedIds={tabel.selectedIds}
            />
          )}

          <PrintDropdownButton
            commands={printCommands}
            disabled={selectedRowId == null}
            loading={isPrintLoading}
            onPrint={handlePrint}
          />
          {tabel ? (
            <TabelReportsDropdown selectedId={selectedRowId ?? null} />
          ) : (
            <DropdownButton label={t('documentListToolbar.reports')} />
          )}
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder={t('pageToolbar.search')}
            value={searchValue}
            className="w-64 bg-ui-01"
            onChange={(e) => {
              onSearchChange(e.target.value)
            }}
            startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
          />
          {tabel ? (
            <TabelMoreDropdown
              pageCode={pageCode}
              moduleCode={moduleCode}
              selectedEntry={tabel.selectedEntry}
              hasCriteria={tabel.hasCriteria}
              onRefresh={tabel.onRefresh}
              onCancelSearch={tabel.onCancelSearch}
            />
          ) : (
            <DropdownButton label={t('documentListToolbar.more')} />
          )}
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

import { useTranslation } from 'react-i18next'
import { CircularProgress } from '@mui/material'

import type { PrintCommand } from '@/entities/document-entry'

import { AiButton } from '@/features/generate-form-config'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { PrintDropdownButton } from './print-dropdown-button'
import DebetKreditIcon from '@/shared/assets/icons/debet-kredit.svg'
import LayersIcon from '@/shared/assets/icons/layers.svg'
import LinkIcon from '@/shared/assets/icons/link.svg'

/** Команды записи/проведения — совпадает с `SubmitAction` карточки документа. */
export type DocumentFormSubmitAction =
  | 'save'
  | 'post'
  | 'saveAndClose'
  | 'postAndClose'

interface DocumentFormActions {
  handleSave: () => void
  handlePost: () => void
  handlePostAndClose: () => void
  /**
   * Идёт запрос записи/проведения. Пока он в полёте кнопки сохранения
   * заблокированы: на документе с большой ТЧ операция занимает минуты, и без
   * блокировки пользователь, не видя реакции, жмёт кнопку повторно — уходят
   * параллельные запросы, каждый из которых пересоздаёт всю ТЧ (это приводило
   * к дублям документов).
   */
  isSubmitting?: boolean
  /** Нажатая команда — именно на ней показываем спиннер. */
  pendingAction?: DocumentFormSubmitAction | null
}

interface DocumentFormPrint {
  onPrint: (form?: string) => void
  isLoading?: boolean
  commands: PrintCommand[]
}

interface AiButtonConfig {
  moduleCode: string
  type: 'documents' | 'dictionaries'
  configExists: boolean
  onSuccess: () => void
  onPendingChange?: (isPending: boolean) => void
}

export interface CommandButton {
  eventName: string
  label: string
  onClick: () => void
  isPending?: boolean
}

interface DocumentFormToolbarProps {
  isNew?: boolean
  isDirty?: boolean
  actions: DocumentFormActions
  print: DocumentFormPrint
  onMovements?: () => void
  aiButton: AiButtonConfig
  commandButtons?: CommandButton[]
  onClearAll?: () => void
}

export const DocumentFormToolbar = ({
  isNew,
  isDirty,
  actions,
  print,
  onMovements,
  aiButton,
  commandButtons,
  onClearAll,
}: DocumentFormToolbarProps) => {
  const { t } = useTranslation()

  const isSubmitting = actions.isSubmitting ?? false
  const submitTitle = isSubmitting
    ? t('documentFormToolbar.submitting')
    : undefined

  const submitIcon = (action: DocumentFormSubmitAction) =>
    actions.pendingAction === action ? (
      <CircularProgress size={14} color="inherit" />
    ) : undefined

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          disabled={isSubmitting}
          aria-busy={actions.pendingAction === 'postAndClose'}
          title={submitTitle}
          startIcon={submitIcon('postAndClose')}
          onClick={actions.handlePostAndClose}
        >
          {t('documentFormToolbar.postAndClose')}
        </Button>
        <Button
          variant="secondary"
          disabled={isSubmitting}
          aria-busy={actions.pendingAction === 'save'}
          title={submitTitle}
          startIcon={submitIcon('save')}
          onClick={actions.handleSave}
        >
          {t('documentFormToolbar.save')}
        </Button>
        <Button
          variant="secondary"
          disabled={isSubmitting}
          aria-busy={actions.pendingAction === 'post'}
          title={submitTitle}
          startIcon={submitIcon('post')}
          onClick={actions.handlePost}
        >
          {t('documentFormToolbar.post')}
        </Button>
        {isSubmitting && (
          <span className="text-[13px] whitespace-nowrap text-ui-05">
            {t('documentFormToolbar.submittingHint')}
          </span>
        )}
        {commandButtons?.map((btn) => (
          <Button
            key={btn.eventName}
            variant="secondary"
            // Команды заполнения меняют ТЧ — во время записи их блокируем,
            // иначе форма поедет под уже отправленным payload'ом.
            disabled={btn.isPending || isSubmitting}
            onClick={btn.onClick}
          >
            {btn.label}
          </Button>
        ))}
        {onClearAll && (
          <Button
            variant="secondary"
            disabled={isSubmitting}
            onClick={onClearAll}
          >
            {t('documentFormToolbar.clearAll')}
          </Button>
        )}
        <PrintDropdownButton
          commands={print.commands}
          disabled={isNew || isDirty || isSubmitting}
          loading={print.isLoading}
          onPrint={print.onPrint}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.debitCredit')}
          disabled={isNew || isSubmitting}
          onClick={onMovements}
          startIcon={<DebetKreditIcon className="h-5 w-5" />}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.layers')}
          startIcon={<LayersIcon className="h-5 w-5" />}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.link')}
          startIcon={<LinkIcon className="h-5 w-5" />}
        />
        <DropdownButton label={t('documentFormToolbar.reports')} />
      </div>

      <div className="flex items-center gap-2">
        <AiButton
          moduleCode={aiButton.moduleCode}
          type={aiButton.type}
          configExists={aiButton.configExists}
          onSuccess={aiButton.onSuccess}
          onPendingChange={aiButton.onPendingChange}
        />
        <DropdownButton label={t('documentFormToolbar.more')} />
      </div>
    </div>
  )
}

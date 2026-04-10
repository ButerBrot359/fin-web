import { useTranslation } from 'react-i18next'

import { Button, DropdownButton } from '@/shared/ui/buttons'
import { PrintDropdownButton } from './print-dropdown-button'
import DebetKreditIcon from '@/shared/assets/icons/debet-kredit.svg'
import LayersIcon from '@/shared/assets/icons/layers.svg'
import LinkIcon from '@/shared/assets/icons/link.svg'

interface DocumentFormActions {
  handleSave: () => void
  handlePost: () => void
  handlePostAndClose: () => void
}

interface DocumentFormPrint {
  onPrint: (language?: string) => void
  isLoading?: boolean
  nameRu?: string
  nameKz?: string
}

interface DocumentFormToolbarProps {
  isNew?: boolean
  isDirty?: boolean
  actions: DocumentFormActions
  print: DocumentFormPrint
}

export const DocumentFormToolbar = ({
  isNew,
  isDirty,
  actions,
  print,
}: DocumentFormToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={actions.handlePostAndClose}>
          {t('documentFormToolbar.postAndClose')}
        </Button>
        <Button variant="secondary" onClick={actions.handleSave}>
          {t('documentFormToolbar.save')}
        </Button>
        <Button variant="secondary" onClick={actions.handlePost}>
          {t('documentFormToolbar.post')}
        </Button>
        <PrintDropdownButton
          nameRu={print.nameRu ?? ''}
          nameKz={print.nameKz ?? ''}
          disabled={isNew || isDirty}
          loading={print.isLoading}
          onPrint={print.onPrint}
        />
        <Button
          variant="secondary"
          aria-label={t('actions.debitCredit')}
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

      <DropdownButton label={t('documentFormToolbar.more')} />
    </div>
  )
}

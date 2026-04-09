import { useTranslation } from 'react-i18next'

import {
  GreenAccentButton,
  DropdownButton,
  IconButtonWrapper,
} from '@/shared/ui/buttons'
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
        <GreenAccentButton onClick={actions.handlePostAndClose}>
          {t('documentFormToolbar.postAndClose')}
        </GreenAccentButton>
        <button
          type="button"
          onClick={actions.handleSave}
          className="cursor-pointer whitespace-nowrap rounded-md bg-ui-01 px-4 py-2.5 text-body2 text-ui-06 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none"
        >
          {t('documentFormToolbar.save')}
        </button>
        <button
          type="button"
          onClick={actions.handlePost}
          className="cursor-pointer whitespace-nowrap rounded-md bg-ui-01 px-4 py-2.5 text-body2 text-ui-06 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none"
        >
          {t('documentFormToolbar.post')}
        </button>
        <PrintDropdownButton
          nameRu={print.nameRu ?? ''}
          nameKz={print.nameKz ?? ''}
          disabled={isNew || isDirty}
          loading={print.isLoading}
          onPrint={print.onPrint}
        />
        <IconButtonWrapper ariaLabel={t('actions.debitCredit')}>
          <DebetKreditIcon className="h-5 w-5" />
        </IconButtonWrapper>
        <IconButtonWrapper ariaLabel={t('actions.layers')}>
          <LayersIcon className="h-5 w-5" />
        </IconButtonWrapper>
        <IconButtonWrapper ariaLabel={t('actions.link')}>
          <LinkIcon className="h-5 w-5" />
        </IconButtonWrapper>
        <DropdownButton label={t('documentFormToolbar.reports')} />
      </div>

      <DropdownButton label={t('documentFormToolbar.more')} />
    </div>
  )
}

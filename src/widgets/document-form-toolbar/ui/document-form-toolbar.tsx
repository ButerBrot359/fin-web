import { useTranslation } from 'react-i18next'

import {
  GreenAccentButton,
  DropdownButton,
  IconButtonWrapper,
} from '@/shared/ui/buttons'
import DebetKreditIcon from '@/shared/assets/icons/debet-kredit.svg'
import LayersIcon from '@/shared/assets/icons/layers.svg'
import LinkIcon from '@/shared/assets/icons/link.svg'

interface DocumentFormToolbarProps {
  isNew?: boolean
  isPrintLoading?: boolean
  onPostAndClose?: () => void
  onSave?: () => void
  onPost?: () => void
  onPrint?: () => void
}

export const DocumentFormToolbar = ({
  isNew,
  isPrintLoading,
  onPostAndClose,
  onSave,
  onPost,
  onPrint,
}: DocumentFormToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <GreenAccentButton onClick={onPostAndClose}>
          {t('documentFormToolbar.postAndClose')}
        </GreenAccentButton>
        <button
          type="button"
          onClick={onSave}
          className="cursor-pointer whitespace-nowrap rounded-md bg-ui-01 px-4 py-2.5 text-body2 text-ui-06 hover:bg-ui-01/60"
        >
          {t('documentFormToolbar.save')}
        </button>
        <button
          type="button"
          onClick={onPost}
          className="cursor-pointer whitespace-nowrap rounded-md bg-ui-01 px-4 py-2.5 text-body2 text-ui-06 hover:bg-ui-01/60"
        >
          {t('documentFormToolbar.post')}
        </button>
        <DropdownButton
          label={t('documentFormToolbar.print')}
          disabled={isNew}
          loading={isPrintLoading}
          onClick={onPrint}
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

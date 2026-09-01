import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

interface InformationRegisterListToolbarProps {
  onCreate: () => void
}

/**
 * Тулбар списка регистра сведений (SCRUM-353) — по образцу
 * DictionaryListToolbar, но у регистра нет групп и копирования (§7 спеки),
 * поэтому только «Создать». Монтируется страницей только при canEdit.
 */
export const InformationRegisterListToolbar = ({
  onCreate,
}: InformationRegisterListToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center pb-3">
      <Button variant="primary" onClick={onCreate}>
        {t('actions.create')}
      </Button>
    </div>
  )
}

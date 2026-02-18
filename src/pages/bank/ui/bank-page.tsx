import { useTranslation } from 'react-i18next'

import { PageToolbar } from '@/features/page-toolbar'

import { BankNavList } from './bank-nav-list'

export const BankPage = () => {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-8 pt-5">
      <PageToolbar title={t('sidebar.nav.bank')} />
      <BankNavList />
    </div>
  )
}

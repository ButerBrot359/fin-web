import { useTranslation } from 'react-i18next'

import { PageToolbar } from '@/features/page-toolbar'

import { useBankModule } from '../lib/hooks/use-bank-module'
import { BankNavList } from './bank-nav-list'

export const BankPage = () => {
  const { t } = useTranslation()
  const { data, isLoading, error } = useBankModule()

  console.log('BankModule data:', data)
  console.log('BankModule error:', error)

  return (
    <div className="flex flex-col gap-8 pt-5">
      <PageToolbar title={t('sidebar.nav.bank')} />
      {isLoading && <div>Loading...</div>}
      <BankNavList />
    </div>
  )
}

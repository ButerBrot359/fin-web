import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { getAccountingRegisterType } from '../../api/accounting-register-api'

export const useAccountingRegisterType = (domain: string, typeCode: string) => {
  const { i18n } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-register-type', domain, typeCode],
    queryFn: () => getAccountingRegisterType(domain, typeCode),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const title = data ? getLocalizedName(data, i18n.language) : ''

  return {
    title,
    attributes: data?.attributes ?? [],
    isLoading,
  }
}

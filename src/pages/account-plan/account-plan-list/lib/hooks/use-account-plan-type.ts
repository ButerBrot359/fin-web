import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { getAccountPlanType } from '../../api/account-plan-api'

export const useAccountPlanType = (domain: string, typeCode: string) => {
  const { i18n } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['account-plan-type', domain, typeCode],
    queryFn: () => getAccountPlanType(domain, typeCode),
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

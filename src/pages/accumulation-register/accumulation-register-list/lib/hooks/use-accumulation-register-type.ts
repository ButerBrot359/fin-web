import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { getAccumulationRegisterType } from '../../api/accumulation-register-api'

export const useAccumulationRegisterType = (
  domain: string,
  typeCode: string
) => {
  const { i18n } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['accumulation-register-type', domain, typeCode],
    queryFn: () => getAccumulationRegisterType(domain, typeCode),
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

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { getInformationRegisterType } from '../../api/information-register-api'

export const useInformationRegisterType = (
  domain: string,
  typeCode: string
) => {
  const { i18n } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['information-register-type', domain, typeCode],
    queryFn: () => getInformationRegisterType(domain, typeCode),
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

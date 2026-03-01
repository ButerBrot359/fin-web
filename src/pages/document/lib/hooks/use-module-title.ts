import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { ModuleItems } from '@/pages/module/types/module'

export const useModuleTitle = (pageCode: string, moduleCode: string) => {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()

  const response = queryClient.getQueryData<{
    data: { data: { items: ModuleItems } }
  }>(['settings', 'modules', pageCode])

  if (!response) return moduleCode

  const items = response.data.data.items

  for (const column of items) {
    for (const section of column) {
      const element = section.elements.find((el) => el.code === moduleCode)
      if (element) {
        return i18n.language === 'kz' ? element.nameKz : element.nameRu
      }
    }
  }

  return moduleCode
}

import {
  useAnalyticsOrganizationStore,
  useAnalyticsOrganizations,
} from '@/entities/analytics'

/**
 * Наименование выбранной организации; `null` — выбраны все.
 *
 * Нужно там, где выбор надо назвать словами, а не показать списком: в заголовке
 * печатного отчёта организация обязана стоять — отчёт без неё неоднозначен.
 */
export const useSelectedOrganizationName = (): string | null => {
  const organizationId = useAnalyticsOrganizationStore(
    (state) => state.organizationId
  )
  const { organizations } = useAnalyticsOrganizations()
  if (organizationId == null) return null
  return (
    organizations.find((organization) => organization.id === organizationId)
      ?.name ?? null
  )
}

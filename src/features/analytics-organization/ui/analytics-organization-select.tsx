import { useId, useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  useAnalyticsOrganizationStore,
  useAnalyticsOrganizations,
} from '@/entities/analytics'
import type { SelectOption } from '@/shared/types/select-option'
import { AutocompleteInput } from '@/shared/ui/inputs'

const ALL = 'all'

/**
 * Выбор организации для всего раздела «Аналитика».
 *
 * Первым пунктом — «Все организации», и он же значение по умолчанию: так ведут
 * себя список документов и форма, ограничения «только свои организации» в
 * приложении нет.
 *
 * Сохранённую организацию, которой больше нет в списке, не подменяем «всеми»
 * молча: запросы по-прежнему идут по ней, и поле обязано показывать то же, что
 * применено, — иначе пустой дашборд подписан «Все организации».
 */
export const AnalyticsOrganizationSelect = () => {
  const { t } = useTranslation()
  const inputId = useId()
  const organizationId = useAnalyticsOrganizationStore(
    (state) => state.organizationId
  )
  const setOrganizationId = useAnalyticsOrganizationStore(
    (state) => state.setOrganizationId
  )
  const { organizations, isLoading } = useAnalyticsOrganizations()

  const allOption = useMemo<SelectOption>(
    () => ({ id: ALL, code: ALL, label: t('analytics.organization.all') }),
    [t]
  )

  const options = useMemo<SelectOption[]>(
    () => [
      allOption,
      ...organizations.map((organization) => ({
        id: organization.id,
        code: String(organization.id),
        label: organization.name,
      })),
    ],
    [allOption, organizations]
  )

  const selected: SelectOption =
    organizationId == null
      ? allOption
      : (options.find((option) => option.id === organizationId) ?? {
          id: organizationId,
          code: String(organizationId),
          label: isLoading
            ? '…'
            : `${t('analytics.organization.notFound')} (id ${String(organizationId)})`,
        })

  return (
    <div className="w-full sm:w-96">
      <Typography
        component="label"
        htmlFor={inputId}
        variant="caption"
        sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}
      >
        {t('analytics.organization.label')}
      </Typography>
      <AutocompleteInput
        fullWidth
        size="small"
        slotProps={{
          htmlInput: {
            id: inputId,
            'aria-label': t('analytics.organization.label'),
          },
        }}
        options={options}
        value={selected}
        loading={isLoading}
        onChange={(option) => {
          setOrganizationId(
            option == null || option.id === ALL ? null : Number(option.id)
          )
        }}
      />
    </div>
  )
}

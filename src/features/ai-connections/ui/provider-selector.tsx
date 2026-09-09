import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { LlmProvider } from '@/entities/analytics'
import { cn } from '@/shared/lib/utils/cn'

import { PROVIDER_OPTIONS } from '../lib/consts/providers'

interface ProviderSelectorProps {
  value: LlmProvider
  onChange: (provider: LlmProvider) => void
}

/**
 * Выбор провайдера — карточки в ряд.
 *
 * Это выбор поставщика, а не фильтр списка, поэтому каждый вариант назван и
 * подписан адресом по умолчанию. Выбранная карточка — единственное место в
 * форме, где рамка несёт смысл: она выделяет объект среди таких же.
 *
 * Четыре карточки в ряд в широком диалоге и по двое в узком: подписи вроде
 * «Claude API (Anthropic)» в четверть ширины УЗКОЙ формы переносились на три
 * строки и карточки переставали быть одной высоты.
 */
export const ProviderSelector = ({
  value,
  onChange,
}: ProviderSelectorProps) => {
  const { t } = useTranslation()

  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
      {PROVIDER_OPTIONS.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            className={cn(
              'flex cursor-pointer flex-col items-start gap-0.5 rounded-lg',
              'border px-3 py-2.5 text-left transition-colors',
              isSelected
                ? 'border-accent-02 bg-ui-04'
                : 'border-ui-03 bg-ui-01 hover:bg-ui-02'
            )}
            onClick={() => {
              onChange(option.value)
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              {t(option.labelKey)}
            </Typography>
            <Typography
              variant="caption"
              className={isSelected ? 'text-ui-06' : 'text-ui-05'}
            >
              {option.host ?? t('analytics.settings.providerLocalHost')}
            </Typography>
          </button>
        )
      })}
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { Button } from '@/shared/ui/buttons'
import type { TranslationKey } from '@/shared/types/i18n.types'

const TYPES: Partial<Record<string, TranslationKey>> = {
  MISSING_IN_JAVA: 'aiAssistant.difference_MISSING_IN_JAVA',
  MISSING_IN_1C: 'aiAssistant.difference_MISSING_IN_1C',
  AMOUNT_MISMATCH: 'aiAssistant.difference_AMOUNT_MISMATCH',
  DATE_MISMATCH: 'aiAssistant.difference_DATE_MISMATCH',
  DIMENSION_MISMATCH: 'aiAssistant.difference_DIMENSION_MISMATCH',
  BALANCE_MISMATCH: 'aiAssistant.difference_BALANCE_MISMATCH',
  REVERSAL_MISMATCH: 'aiAssistant.difference_REVERSAL_MISMATCH',
}
const COUNTS: [string, TranslationKey][] = [
  ['totalMovements1C', 'aiAssistant.comparison1c'],
  ['totalMovementsJava', 'aiAssistant.comparisonWebbuh'],
  ['matchingMovements', 'aiAssistant.comparisonMatched'],
  ['differencesFound', 'aiAssistant.comparisonDifferences'],
]

export function AssistantComparisonResult({
  result,
}: {
  result: Record<string, unknown>
}) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(20)
  const differences = Array.isArray(result.differences)
    ? result.differences.filter(
        (value): value is Record<string, unknown> =>
          !!value && typeof value === 'object'
      )
    : []
  const amount = (value: unknown) =>
    typeof value === 'number' || typeof value === 'string' ? String(value) : '—'
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Typography variant="caption" fontWeight={600}>
        {t('aiAssistant.comparisonTitle')}
      </Typography>
      {COUNTS.map(
        ([key, label]) =>
          typeof result[key] === 'number' && (
            <Typography key={key} variant="caption">
              {t(label, { count: result[key] })}
            </Typography>
          )
      )}
      {differences.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-ui-05">
            {t('aiAssistant.comparisonDetails')}
          </summary>
          <div
            className="max-h-60 overflow-y-auto"
            onScroll={(event) => {
              const node = event.currentTarget
              if (node.scrollHeight - node.scrollTop - node.clientHeight < 40)
                setVisible((count) => Math.min(count + 20, differences.length))
            }}
          >
            {differences.slice(0, visible).map((difference, index) => (
              <div key={index} className="border-b border-ui-03 py-1 text-xs">
                <p className="break-words">
                  {typeof difference.type === 'string'
                    ? t(TYPES[difference.type] ?? 'aiAssistant.comparisonDetails')
                    : t('aiAssistant.comparisonDetails')}
                </p>
                {typeof difference.date === 'string' && (
                  <time dateTime={difference.date}>{difference.date}</time>
                )}
                <p className="break-words tabular-nums">
                  1С: {amount(difference.amount1C)} · WebbUh:{' '}
                  {amount(difference.amountJava)}
                </p>
                {typeof difference.dimensionKey === 'string' && (
                  <p className="break-words text-ui-05">
                    {difference.dimensionKey}
                  </p>
                )}
              </div>
            ))}
          </div>
          {visible < differences.length && (
            <Button
              size="small"
              variant="tertiary"
              onClick={() => {
                setVisible((count) => count + 20)
              }}
            >
              {t('aiAssistant.comparisonMore')}
            </Button>
          )}
        </details>
      )}
    </div>
  )
}

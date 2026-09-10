import { useId } from 'react'
import {
  Box,
  Checkbox,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { LlmProvider } from '@/entities/analytics'
import {
  PRICE_KEYS,
  type PricingDraft,
} from '../lib/pricing/connection-pricing'
import { pricingCopy } from '../lib/pricing/pricing-copy'
import { parsePriceValue } from '../lib/pricing/price-value'

export function ConnectionPricingSection({
  draft,
  onChange,
  provider,
  model,
  cacheEnabled,
  onCacheChange,
}: {
  draft: PricingDraft
  onChange: (draft: PricingDraft) => void
  provider: LlmProvider
  model: string
  cacheEnabled: boolean
  onCacheChange: (enabled: boolean) => void
}) {
  const fieldId = useId()
  const { i18n } = useTranslation()
  const copy = pricingCopy(i18n.language)
  const labels = [
    copy.input,
    copy.output,
    copy.cachedInput,
    copy.cacheWriteGeneral,
    copy.cacheWrite,
    copy.cacheWrite1h,
  ]
  const supportsCache =
    provider === 'ANTHROPIC' ||
    (provider === 'OPENROUTER' && model.startsWith('anthropic/'))
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography fontWeight={600}>{copy.title}</Typography>
      <Typography variant="body2" color="primary" mb={1}>
        {copy.units}
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        {copy.hint}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        {PRICE_KEYS.map((key, index) => (
          <Box key={key}>
            <Typography
              component="label"
              htmlFor={`${fieldId}-${key}`}
              variant="body2"
              display="block"
              mb={0.75}
            >
              {labels[index]}
            </Typography>
            <TextField
              fullWidth
              size="small"
              id={`${fieldId}-${key}`}
              value={draft[key]}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              error={parsePriceValue(draft[key]) === undefined}
              onChange={(event) => {
                onChange({ ...draft, [key]: event.target.value })
              }}
            />
            {parsePriceValue(draft[key]) === undefined && (
              <Typography variant="caption" color="error">
                {copy.invalid}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      {supportsCache && (
        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Checkbox
              checked={cacheEnabled}
              onChange={(_, checked) => {
                onCacheChange(checked)
              }}
            />
          }
          label={copy.cache}
        />
      )}
      <Typography variant="body2" color="text.secondary" mt={1.5}>
        {supportsCache
          ? copy.cacheHint
          : provider === 'LOCAL'
            ? copy.local
            : provider === 'OPENAI' || model.startsWith('openai/')
              ? copy.automatic
              : copy.other}
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={1.5}>
        {copy.history}
      </Typography>
    </Paper>
  )
}

import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Typography } from '@mui/material'

import { formatDateTime } from '@/shared/lib/utils/date'

import type {
  AccessChannel,
  AccessPolicyOverview,
} from '../api/access-policy-api'

/** Цвет бейджа режима: OFF — нейтральный, SHADOW — внимание, ENFORCE — действует. */
const MODE_CHIP_COLOR = {
  OFF: 'default',
  SHADOW: 'warning',
  ENFORCE: 'success',
} as const

const ModeChip: FC<{ mode: string }> = ({ mode }) => (
  <Chip
    size="small"
    label={mode}
    color={
      mode in MODE_CHIP_COLOR
        ? MODE_CHIP_COLOR[mode as keyof typeof MODE_CHIP_COLOR]
        : 'default'
    }
  />
)

/** Блок «Текущее состояние» (SCRUM-400 §11.6 п.1). */
export const PolicyOverviewBlock: FC<{ overview: AccessPolicyOverview }> = ({
  overview,
}) => {
  const { t } = useTranslation()
  const overrides = Object.entries(overview.channelModes) as [
    AccessChannel,
    string,
  ][]
  const recordScope = overview.channelModes.RECORD_SCOPE ?? 'OFF'
  const smoke = overview.smoke
  const smokeFailedFlags = (
    [
      'runtimeStateReadable',
      'projectionSafeToEnforce',
      'channelModesHealthy',
      'rightsDataReady',
    ] as const
  ).filter((flag) => !smoke[flag])

  return (
    <section className="flex flex-col gap-3">
      <Typography component="h2" fontSize={18} fontWeight={700}>
        {t('accessPolicy.state.title')}
      </Typography>

      <div className="flex items-center gap-2">
        <Typography variant="body2">{t('accessPolicy.state.mode')}:</Typography>
        <ModeChip mode={overview.mode} />
        <Typography variant="body2" color="text.secondary">
          {t('accessPolicy.state.revision')}: {overview.policyRevision}
        </Typography>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Typography variant="body2">
          {t('accessPolicy.state.channelOverrides')}:
        </Typography>
        {overrides.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('accessPolicy.state.noOverrides')}
          </Typography>
        ) : (
          overrides.map(([channel, mode]) => (
            <Chip
              key={channel}
              size="small"
              variant="outlined"
              label={`${t(`accessPolicy.channels.${channel}`)}: ${mode}`}
            />
          ))
        )}
      </div>

      {/* RLS — отдельной строкой (§11.6): включается последним и отдельно. */}
      <div className="flex items-center gap-2">
        <Typography variant="body2">
          {t('accessPolicy.state.recordScope')}:
        </Typography>
        <ModeChip mode={recordScope} />
      </div>

      <Typography variant="body2">
        {t('accessPolicy.state.activeRelease')}:{' '}
        {overview.activeRelease ? (
          <>
            {overview.activeRelease.policyVersion}
            {overview.activeRelease.activatedAt &&
              ` — ${formatDateTime(overview.activeRelease.activatedAt)}`}
            {overview.activeRelease.activatedBy &&
              `, ${t('accessPolicy.state.activatedBy', {
                user: overview.activeRelease.activatedBy,
              })}`}
          </>
        ) : (
          t('accessPolicy.state.noActiveRelease')
        )}
      </Typography>

      {overview.pendingSubjectsCount > 0 && (
        <Typography variant="body2" color="warning.main" role="status">
          {t('accessPolicy.state.pendingSubjects')} (
          {overview.pendingSubjectsCount})
        </Typography>
      )}

      {smoke.ok ? (
        <Typography variant="body2" color="success.main">
          {t('accessPolicy.state.smokeOk')}
        </Typography>
      ) : (
        <div className="flex flex-col gap-1">
          <Typography variant="body2" color="error">
            {t('accessPolicy.state.smokeProblems')}
            {smokeFailedFlags.length > 0 && `: ${smokeFailedFlags.join(', ')}`}
          </Typography>
          {/* Причины — машинные строки сервера, показываются как есть (§11.3). */}
          {smoke.rightsDataProblems.map((problem) => (
            <Typography key={problem} variant="body2" color="text.secondary">
              • {problem}
            </Typography>
          ))}
        </div>
      )}
    </section>
  )
}

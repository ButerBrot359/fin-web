import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import {
  rollbackAccessPolicy,
  switchAccessPolicy,
  type AccessEnforcementMode,
  type AccessPolicyOverview,
  type AccessPolicySwitchResult,
} from '../api/access-policy-api'
import { parseAccessPolicyError } from '../lib/access-policy-errors'
import { ACCESS_POLICY_OVERVIEW_KEY } from '../lib/query-keys'

const MODES: AccessEnforcementMode[] = ['OFF', 'SHADOW', 'ENFORCE']

type PendingAction = { kind: 'apply' } | { kind: 'rollback' } | { kind: 'off' }

/**
 * Переключатель режима прав (SCRUM-400 §11.6 п.2–6, 8): глобальный режим,
 * отдельный RECORD_SCOPE, «Проверить» (dryRun), «Применить» с подтверждением
 * и обязательным комментарием, откат и аварийное выключение. Правила
 * переходов дублируются только подсказками — решает сервер.
 */
export const PolicySwitchForm: FC<{ overview: AccessPolicyOverview }> = ({
  overview,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<AccessEnforcementMode>(overview.mode)
  const [recordScope, setRecordScope] = useState<AccessEnforcementMode>(
    overview.channelModes.RECORD_SCOPE ?? 'OFF'
  )
  const [comment, setComment] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [result, setResult] = useState<AccessPolicySwitchResult | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [errorText, setErrorText] = useState<string | null>(null)

  const invalidateOverview = () =>
    queryClient.invalidateQueries({ queryKey: ACCESS_POLICY_OVERVIEW_KEY })

  /**
   * Карта каналов для switch: ПЕРЕДАННАЯ карта заменяет прежнюю целиком
   * (§11.6 п.3) — прежние переопределения из overview сохраняем явно, меняем
   * только RECORD_SCOPE. Если RECORD_SCOPE не трогали и прочих изменений нет —
   * null («не менять»).
   */
  const buildChannelModes = () => {
    const current = overview.channelModes.RECORD_SCOPE ?? 'OFF'
    if (recordScope === current) return null
    const next = { ...overview.channelModes }
    if (recordScope === 'OFF') delete next.RECORD_SCOPE
    else next.RECORD_SCOPE = recordScope
    return next
  }

  const handleError = (error: unknown) => {
    const parsed = parseAccessPolicyError(error)
    setProblems(parsed.problems)
    setErrorText(
      parsed.kind === 'policy-changed'
        ? t('accessPolicy.errors.changed')
        : parsed.message
    )
    // §11.4: устаревшая ревизия — перечитать состояние, БЕЗ автоповтора.
    if (parsed.kind === 'policy-changed') void invalidateOverview()
  }

  const switchMutation = useMutation({
    mutationFn: switchAccessPolicy,
    onSuccess: (res, variables) => {
      setResult(res)
      setProblems(res.problems)
      setErrorText(null)
      if (variables.dryRun !== true) {
        setComment('')
        showToast('success', t('accessPolicy.switch.applied'))
        void invalidateOverview()
      }
    },
    onError: handleError,
  })

  const rollbackMutation = useMutation({
    mutationFn: rollbackAccessPolicy,
    onSuccess: () => {
      setErrorText(null)
      setProblems([])
      void invalidateOverview()
    },
    onError: handleError,
  })

  const busy = switchMutation.isPending || rollbackMutation.isPending

  const runCheck = () => {
    setResult(null)
    switchMutation.mutate({
      mode,
      channelModes: buildChannelModes(),
      expectedPolicyRevision: overview.policyRevision,
      dryRun: true,
    })
  }

  const confirmPending = () => {
    if (!pending) return
    setPending(null)
    setResult(null)
    if (pending.kind === 'rollback') {
      rollbackMutation.mutate({
        expectedPolicyRevision: overview.policyRevision,
        expectedActiveReleaseId: overview.activeRelease?.id ?? null,
        expectedManifestSha256: overview.activeRelease?.manifestSha256 ?? null,
      })
      return
    }
    switchMutation.mutate({
      mode: pending.kind === 'off' ? 'OFF' : mode,
      // Аварийный OFF снимает и переопределения каналов (§11.5).
      channelModes: pending.kind === 'off' ? {} : buildChannelModes(),
      expectedPolicyRevision: overview.policyRevision,
      comment: comment.trim(),
    })
  }

  const commentMissing = comment.trim() === ''
  // Подсказка (решает сервер): из OFF в ENFORCE нельзя — только через SHADOW.
  const enforceBlocked = overview.mode === 'OFF'

  const confirmTitle =
    pending?.kind === 'rollback'
      ? t('accessPolicy.switch.confirmRollbackTitle')
      : pending?.kind === 'off'
        ? t('accessPolicy.switch.confirmOffTitle')
        : t('accessPolicy.switch.confirmTitle')
  const confirmMessage =
    pending?.kind === 'rollback'
      ? t('accessPolicy.switch.confirmRollbackMessage')
      : pending?.kind === 'off'
        ? t('accessPolicy.switch.confirmOffMessage')
        : t('accessPolicy.switch.confirmMessage')

  return (
    <section className="flex flex-col gap-4">
      <Typography component="h2" fontSize={18} fontWeight={700}>
        {t('accessPolicy.switch.title')}
      </Typography>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_e, next: AccessEnforcementMode | null) => {
          if (next) setMode(next)
        }}
      >
        {MODES.map((m) => (
          <ToggleButton
            key={m}
            value={m}
            disabled={m === 'ENFORCE' && enforceBlocked}
          >
            {m}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary">
        {enforceBlocked
          ? t('accessPolicy.switch.enforceBlockedFromOff')
          : t('accessPolicy.switch.enforceHint')}
      </Typography>

      <div className="flex flex-col gap-2">
        <Typography variant="body2" fontWeight={600}>
          {t('accessPolicy.switch.recordScopeTitle')}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={recordScope}
          onChange={(_e, next: AccessEnforcementMode | null) => {
            if (next) setRecordScope(next)
          }}
        >
          {MODES.map((m) => (
            <ToggleButton key={m} value={m}>
              {m}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          {t('accessPolicy.switch.recordScopeHint')}
        </Typography>
      </div>

      <TextField
        size="small"
        label={t('accessPolicy.switch.comment')}
        helperText={t('accessPolicy.switch.commentHint')}
        value={comment}
        onChange={(e) => {
          setComment(e.target.value)
        }}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        multiline
        maxRows={3}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={busy} onClick={runCheck}>
          {t('accessPolicy.switch.check')}
        </Button>
        <Tooltip
          title={commentMissing ? t('accessPolicy.switch.commentHint') : ''}
        >
          <span style={{ display: 'inline-flex' }}>
            <Button
              variant="primary"
              disabled={busy || commentMissing}
              onClick={() => {
                setPending({ kind: 'apply' })
              }}
            >
              {t('accessPolicy.switch.apply')}
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setPending({ kind: 'rollback' })
          }}
        >
          {t('accessPolicy.switch.rollback')}
        </Button>
        <Tooltip
          title={commentMissing ? t('accessPolicy.switch.commentHint') : ''}
        >
          <span style={{ display: 'inline-flex' }}>
            <Button
              variant="secondary"
              disabled={busy || commentMissing}
              onClick={() => {
                setPending({ kind: 'off' })
              }}
            >
              {t('accessPolicy.switch.emergencyOff')}
            </Button>
          </span>
        </Tooltip>
      </div>

      {result?.outcome === 'CHECK_PASSED' && (
        <Typography variant="body2" color="success.main" role="status">
          {t('accessPolicy.switch.dryRunPassed')}
        </Typography>
      )}
      {result?.outcome === 'CHECK_FAILED' && (
        <Typography variant="body2" color="error" role="alert">
          {t('accessPolicy.switch.dryRunFailed')}
        </Typography>
      )}
      {errorText && (
        <Typography variant="body2" color="error" role="alert">
          {errorText}
        </Typography>
      )}
      {problems.length > 0 && (
        <div className="flex flex-col gap-1">
          <Typography variant="body2" fontWeight={600}>
            {t('accessPolicy.switch.problemsTitle')}
          </Typography>
          {/* §11.4: строки сервера как есть, по одной на строку, не разбирать. */}
          {problems.map((problem) => (
            <Typography key={problem} variant="body2" color="text.secondary">
              • {problem}
            </Typography>
          ))}
        </div>
      )}

      <Dialog
        open={pending !== null}
        onClose={() => {
          setPending(null)
        }}
      >
        <div className="flex max-w-[480px] flex-col gap-4 p-6">
          <Typography component="h2" fontSize={18} fontWeight={700}>
            {confirmTitle}
          </Typography>
          <Typography variant="body2">{confirmMessage}</Typography>
          {pending?.kind === 'apply' && mode === 'ENFORCE' && (
            <Typography variant="body2" color="error">
              {t('accessPolicy.switch.confirmEnforceWarning')}
            </Typography>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setPending(null)
              }}
            >
              {t('accessPolicy.switch.cancel')}
            </Button>
            <Button variant="primary" onClick={confirmPending}>
              {confirmTitle.replace('?', '')}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'

import {
  getInactivityLocks,
  unlockInactivity,
  type InactivityLock,
} from '../api/inactivity-locks-api'
import { Button } from '@/shared/ui/buttons/button'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

/**
 * Снятие блокировок по бездействию (ТЗ §А4, требование заказчика от 08.09.2026).
 *
 * <b>Основание вводится в строке, а не спрашивается диалогом «уверены?».</b> Разблокировка — это
 * «согласие руководства», и единственное, что делает её отличимой от самовольной, — записанное
 * основание: чьё согласие, на чём. Оно уходит в журнал регистрации, поэтому кнопка не работает,
 * пока поле пустое.
 *
 * Список после снятия блокировки перечитывается целиком, а не правится на месте: заблокирован
 * человек или нет, решает сервер по своему порогу, и держать на клиенте вторую копию этого правила
 * значит однажды показать список, расходящийся с тем, кого действительно не пускают.
 */
export const InactivityLocksPage = () => {
  const { t } = useTranslation()
  const [locks, setLocks] = useState<InactivityLock[] | null>(null)
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [busyUserId, setBusyUserId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    getInactivityLocks()
      .then((loaded) => {
        setLocks(loaded)
        setError(null)
      })
      .catch(() => {
        setLocks([])
        setError(t('inactivityLocks.loadFailed'))
      })
  }, [t])

  useEffect(reload, [reload])

  const handleUnlock = (appUserId: number) => {
    const reason = (reasons[appUserId] ?? '').trim()
    if (!reason) return

    setBusyUserId(appUserId)
    unlockInactivity(appUserId, reason)
      .then(() => {
        // Основание после успешной разблокировки не хранится: строка уходит из списка, а её
        // текст уже записан в журнал регистрации на сервере.
        setReasons((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(
              ([key]) => key !== String(appUserId)
            )
          )
        )
        reload()
      })
      .catch(() => {
        setError(t('inactivityLocks.unlockFailed'))
      })
      .finally(() => {
        setBusyUserId(null)
      })
  }

  if (locks === null) {
    return <PageSkeleton />
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <Typography component="h1" fontSize={24} fontWeight={700}>
        {t('inactivityLocks.title')}
      </Typography>

      <Typography variant="body2" color="text.secondary">
        {t('inactivityLocks.hint')}
      </Typography>

      {error && (
        <Typography role="alert" variant="body2" color="error">
          {error}
        </Typography>
      )}

      {locks.length === 0 ? (
        <Typography variant="body2">{t('inactivityLocks.empty')}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('inactivityLocks.user')}</TableCell>
              <TableCell>{t('inactivityLocks.lastLogin')}</TableCell>
              <TableCell align="right">{t('inactivityLocks.days')}</TableCell>
              <TableCell>{t('inactivityLocks.reason')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {locks.map((lock) => (
              <TableRow key={lock.appUserId}>
                <TableCell>
                  {lock.displayName ?? lock.login}
                  {lock.displayName && lock.displayName !== lock.login && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      {lock.login}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {lock.lastLoginAt
                    ? new Date(lock.lastLoginAt).toLocaleString()
                    : t('inactivityLocks.neverLoggedIn')}
                </TableCell>
                <TableCell align="right">
                  {lock.inactiveWorkingDays} / {lock.thresholdWorkingDays}
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={t('inactivityLocks.reasonPlaceholder')}
                    value={reasons[lock.appUserId] ?? ''}
                    onChange={(event) => {
                      const { value } = event.target
                      setReasons((previous) => ({
                        ...previous,
                        [lock.appUserId]: value,
                      }))
                    }}
                    disabled={busyUserId === lock.appUserId}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="primary"
                    disabled={
                      busyUserId === lock.appUserId ||
                      !(reasons[lock.appUserId] ?? '').trim()
                    }
                    onClick={() => {
                      handleUnlock(lock.appUserId)
                    }}
                  >
                    {t('inactivityLocks.unlock')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

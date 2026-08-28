import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import { callSounds } from '../lib/call-sounds'
import type { SupportCall, SupportCallSession } from '../model/types'
import { useJoinSupportCall, useSupportQueue } from '../model/use-support-call'
import { SupportDialog } from './support-dialog'

interface SupportQueueDialogProps {
  onClose: () => void
  onConnected: (session: SupportCallSession) => void
}

/**
 * Очередь обращений (ADR-0050).
 *
 * <p>Ожидающие идут первыми — их отдаёт сервер в этом порядке. Уже взятые обращения из списка
 * не исчезают: агенту нужно видеть, что происходит у смены, и вернуться в свой разговор,
 * если он закрыл вкладку.
 *
 * <p>Ждущие выделены красной полосой слева и кнопкой «Ответить»; идущие разговоры — спокойные,
 * без акцента. Разница видна с одного взгляда, а не после чтения подписей.
 */
export const SupportQueueDialog = ({
  onClose,
  onConnected,
}: SupportQueueDialogProps) => {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useSupportQueue(true)
  const { mutate, isPending, error } = useJoinSupportCall()
  const calls = data ?? []
  const waitingCount = calls.filter((call) => call.status === 'WAITING').length

  const secondary = (call: SupportCall) => {
    if (call.status === 'WAITING') {
      // Локаль берётся из языка интерфейса, а не из системы: иначе в русской версии время
      // показывается американским «8:23 PM», что тут читается как ошибка.
      const time = new Date(call.startedAt).toLocaleTimeString(
        i18n.language === 'kz' ? 'kk-KZ' : 'ru-RU',
        { hour: '2-digit', minute: '2-digit' }
      )
      return (
        t('support.waitingSince', { time }) +
        (call.page ? ` · ${call.page}` : '')
      )
    }
    return call.agentLogin
      ? t('support.takenBy', { agent: call.agentLogin })
      : t('support.inCall')
  }

  return (
    <SupportDialog
      title={t('support.queueTitle')}
      subtitle={
        waitingCount > 0
          ? t('support.queueWaiting', { count: waitingCount })
          : undefined
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-2">
        {Boolean(error) && (
          <div className="rounded-lg bg-support-01/10 px-4 py-3 text-body2 text-support-01">
            {t('support.error')}
          </div>
        )}

        {isLoading && (
          <p className="text-body2 text-ui-05">{t('support.queueLoading')}</p>
        )}

        {!isLoading && calls.length === 0 && (
          <p className="rounded-lg bg-ui-02 px-4 py-6 text-center text-body2 text-ui-05">
            {t('support.queueEmpty')}
          </p>
        )}

        {calls.map((call) => {
          const waiting = call.status === 'WAITING'
          return (
            <button
              key={call.id}
              type="button"
              disabled={isPending}
              onClick={() => {
                callSounds.answer()
                mutate(call.id, { onSuccess: onConnected })
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-4 rounded-lg border-l-4 px-4 py-3 text-left transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-60',
                waiting
                  ? 'border-support-01 bg-ui-02 hover:bg-ui-04'
                  : 'border-ui-03 bg-ui-02 hover:bg-ui-04'
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body1 text-ui-06">
                  {call.callerLogin}
                  {call.subject ? ` — ${call.subject}` : ''}
                </span>
                <span className="mt-0.5 block truncate text-body2 text-ui-05">
                  {secondary(call)}
                </span>
              </span>

              {waiting && (
                <span className="shrink-0 rounded-md bg-accent-01 px-3 py-1.5 text-body2 text-ui-06">
                  {t('support.answer')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </SupportDialog>
  )
}

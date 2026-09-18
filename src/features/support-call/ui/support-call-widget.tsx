import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'

import type { SupportCallSession } from '../model/types'
import {
  useActiveSupportSession,
  useEndSupportCall,
} from '../model/use-support-call'
import { CallRoomDialog } from './call-room-dialog'
import { CallerDialog } from './caller-dialog'
import { SupportFab } from './support-fab'
import { SupportQueueButton } from './support-queue-button'
import { SupportQueueDialog } from './support-queue-dialog'

/**
 * Живая поддержка (ADR-0050).
 *
 * <p>Что видит пользователь, зависит от признака `supportAgent`: агент — очередь обращений,
 * остальные — кнопку «Позвонить». Это разделение интерфейса, а не защита: право отвечать на
 * звонки проверяет сервер при подключении, и снятый флаг закрывает доступ сразу, а не через
 * оставшееся время жизни токена.
 */
export const SupportCallWidget = () => {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const isAgent = Boolean(user?.supportAgent)

  const [session, setSession] = useState<SupportCallSession | null>(null)
  const [dismissedRestore, setDismissedRestore] = useState(false)
  const [callerOpen, setCallerOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  // Возврат в разговор после перезагрузки страницы. Комната на SFU живёт дальше, там остался
  // собеседник — молча бросать его нельзя. Сервер отдаёт свежий токен: прежний к этому
  // моменту чаще всего истёк.
  const { data: restored } = useActiveSupportSession(Boolean(user))
  const restoreAvailable = Boolean(restored) && !session && !dismissedRestore

  const { mutate: endCall } = useEndSupportCall()

  if (!user) return null

  return (
    <>
      {/* Во время разговора кнопки нет: её угол занимает свёрнутая плашка разговора, а звать
          поддержку, уже разговаривая с ней, незачем. */}
      {!session && (
        <div className="fixed right-6 bottom-6 z-[1050]">
          {/* Возврат в разговор — состояние ТОЙ ЖЕ кнопки, а не вторая плашка рядом.
            Отдельный элемент выглядел чужеродно и занимал место постоянно, хотя нужен
            в редком случае: вкладку перезагрузили посреди звонка. */}
          {restoreAvailable && restored ? (
            <SupportFab
              tone="live"
              pulsing
              label={t('support.restoring')}
              onClick={() => {
                setSession(restored)
              }}
            >
              <PhoneInTalkIcon />
            </SupportFab>
          ) : isAgent ? (
            <SupportQueueButton
              onOpen={() => {
                setQueueOpen(true)
              }}
              onAnswer={setSession}
            />
          ) : (
            <SupportFab
              tone="brand"
              label={t('support.fabCall')}
              onClick={() => {
                setCallerOpen(true)
              }}
            >
              <HeadsetMicIcon />
            </SupportFab>
          )}
        </div>
      )}

      {callerOpen && (
        <CallerDialog
          onClose={() => {
            setCallerOpen(false)
          }}
          onConnected={(next) => {
            setCallerOpen(false)
            setSession(next)
          }}
        />
      )}

      {queueOpen && (
        <SupportQueueDialog
          onClose={() => {
            setQueueOpen(false)
          }}
          onConnected={(next) => {
            setQueueOpen(false)
            setSession(next)
          }}
        />
      )}

      {session && (
        <CallRoomDialog
          session={session}
          onClose={(byUser) => {
            // Разговор заканчивает тот, кто этого захотел: сервер закрывает обращение и
            // рвёт комнату, поэтому у собеседника звонок обрывается тем же движением.
            // Без этого закрытое с одной стороны обращение оставалось в очереди поддержки
            // и продолжало мигать входящим — разговора уже нет, а звонок как будто идёт.
            if (byUser) {
              endCall(session.callId)
            }
            setSession(null)
            // Предлагать вернуться в законченный разговор больше не нужно. Без этого кнопка
            // «вернуться» появлялась снова сразу после выхода: ответ сервера про активный
            // разговор лежит в кеше и сам по себе не пересматривается.
            setDismissedRestore(true)
          }}
        />
      )}
    </>
  )
}

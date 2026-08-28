import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import { Tooltip } from '@mui/material'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'
import { cn } from '@/shared/lib/utils/cn'

import type { SupportCallSession } from '../model/types'
import {
  useActiveSupportSession,
  useEndSupportCall,
  useJoinSupportCall,
  useSupportQueue,
} from '../model/use-support-call'
import { CallRoomDialog } from './call-room-dialog'
import { CallerDialog } from './caller-dialog'
import { IncomingCallCard } from './incoming-call-card'
import { SupportQueueDialog } from './support-queue-dialog'

type FabTone = 'brand' | 'alert' | 'live'

const TONE_CLASSES: Record<FabTone, string> = {
  brand: 'bg-accent-01 text-ui-06 hover:bg-accent-01-hover',
  alert: 'bg-support-01 text-ui-01 hover:brightness-95',
  live: 'bg-accent-02 text-ui-01 hover:brightness-95',
}

const RING_CLASSES: Record<FabTone, string> = {
  brand: 'bg-accent-01/40',
  alert: 'bg-support-01/40',
  live: 'bg-accent-02/40',
}

/**
 * Круглая кнопка виджета.
 *
 * <p>Три оттенка вместо трёх разных элементов: обычное состояние — фирменный лайм, как у любой
 * главной кнопки webbuh; ждущий ответа звонок — красный; возврат в идущий разговор — синий.
 * Пульсация привязана только к ожиданию ответа: она означает «нужно ответить», а не «что-то
 * происходит».
 */
const SupportFab = ({
  tone,
  label,
  badge,
  pulsing,
  onClick,
  children,
}: {
  tone: FabTone
  label: string
  badge?: number
  pulsing?: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <Tooltip title={label} placement="left">
    <span className="relative inline-flex">
      {pulsing && (
        <span
          className={cn(
            'absolute inset-0 animate-ping rounded-full',
            RING_CLASSES[tone]
          )}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          'relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-[0px_3px_16px_0px_rgba(42,117,244,0.35)] transition-all',
          TONE_CLASSES[tone]
        )}
      >
        {children}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ui-06 px-1 text-[11px] font-medium text-ui-01">
            {badge}
          </span>
        )}
      </button>
    </span>
  </Tooltip>
)

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
      <div className="fixed right-6 bottom-20 z-[1050]">
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

/**
 * Кнопка агента.
 *
 * <p>Пока кто-то ждёт — на её месте разворачивается карточка входящего: счётчик говорит только
 * «есть обращения», а решение брать трубку требует знать, кто звонит и с чем. Без ожидающих —
 * обычная кнопка со счётчиком идущих разговоров.
 */
const SupportQueueButton = ({
  onOpen,
  onAnswer,
}: {
  onOpen: () => void
  onAnswer: (session: SupportCallSession) => void
}) => {
  const { t } = useTranslation()
  const { data } = useSupportQueue(true)
  const { mutate } = useJoinSupportCall()
  // Свёрнутость привязана к конкретному обращению: свернул один звонок — следующий
  // всё равно развернётся. Иначе агент, свернувший карточку однажды, перестал бы
  // видеть развёрнутыми все последующие звонки.
  const [collapsedCallId, setCollapsedCallId] = useState<number | null>(null)

  const calls = data ?? []
  const waitingCalls = calls.filter((call) => call.status === 'WAITING')
  const waiting = waitingCalls.length
  const ringing = waiting > 0
  // Явная проверка длины, а не `waitingCalls[0] &&`: индексный доступ типизирован как
  // непустой, и условие на него линтер справедливо считает всегда истинным.
  const first = ringing ? waitingCalls[0] : null

  if (first !== null && collapsedCallId !== first.id) {
    return (
      <IncomingCallCard
        call={first}
        moreWaiting={waiting - 1}
        onAnswer={() => {
          mutate(first.id, { onSuccess: onAnswer })
        }}
        onOpenQueue={onOpen}
        onCollapse={() => {
          setCollapsedCallId(first.id)
        }}
      />
    )
  }

  return (
    <SupportFab
      tone={ringing ? 'alert' : 'brand'}
      pulsing={ringing}
      badge={waiting || calls.length}
      label={ringing ? t('support.fabIncoming') : t('support.fabQueue')}
      onClick={onOpen}
    >
      {ringing ? <PhoneInTalkIcon /> : <SupportAgentIcon />}
    </SupportFab>
  )
}

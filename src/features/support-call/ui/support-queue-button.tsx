import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SupportCallSession } from '../model/types'
import { useJoinSupportCall, useSupportQueue } from '../model/use-support-call'
import { IncomingCallCard } from './incoming-call-card'
import { SupportFab } from './support-fab'

/**
 * Кнопка агента.
 *
 * <p>Пока кто-то ждёт — на её месте разворачивается карточка входящего: счётчик говорит только
 * «есть обращения», а решение брать трубку требует знать, кто звонит и с чем. Без ожидающих —
 * обычная кнопка со счётчиком идущих разговоров.
 */
export const SupportQueueButton = ({
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

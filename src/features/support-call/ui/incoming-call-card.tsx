import CloseIcon from '@mui/icons-material/Close'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import { Grow } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { SupportCall } from '../model/types'

interface IncomingCallCardProps {
  /** Обращение, которое показываем крупно, — самое давнее из ожидающих. */
  call: SupportCall
  /** Сколько ещё ожидающих кроме показанного. */
  moreWaiting: number
  onAnswer: () => void
  onOpenQueue: () => void
  onCollapse: () => void
}

/**
 * Карточка входящего звонка (ADR-0050).
 *
 * <p>Разворачивается на месте кнопки, когда кто-то ждёт ответа. Кнопка со счётчиком говорит
 * только «есть обращения» — а агенту важно решить, брать ли трубку прямо сейчас, и для этого
 * нужно видеть, кто звонит и с чем. Поэтому здесь имя, тема и раздел, из которого позвонили.
 *
 * <p>Красный — только сигнал: шапка и пульс аватара. Само действие «Ответить» остаётся фирменным
 * лаймом, как любая главная кнопка webbuh; красная кнопка на красной карточке читалась бы как
 * «отменить», а не «взять трубку».
 *
 * <p>Карточку можно свернуть обратно в кнопку: агент бывает занят разговором или документом,
 * и держать перед ним несворачиваемый блок — значит мешать работать.
 */
export const IncomingCallCard = ({
  call,
  moreWaiting,
  onAnswer,
  onOpenQueue,
  onCollapse,
}: IncomingCallCardProps) => {
  const { t, i18n } = useTranslation()

  const time = new Date(call.startedAt).toLocaleTimeString(
    i18n.language === 'kz' ? 'kk-KZ' : 'ru-RU',
    { hour: '2-digit', minute: '2-digit' }
  )

  return (
    <Grow in appear>
      <div className="w-80 overflow-hidden rounded-[20px] bg-ui-01 shadow-[0px_3px_24px_0px_rgba(42,117,244,0.4)]">
        <div className="flex items-center gap-2 bg-support-01 px-5 py-3 text-ui-01">
          <PhoneInTalkIcon sx={{ fontSize: 18 }} />
          <span className="flex-1 text-body2">
            {t('support.incomingTitle')}
          </span>
          <span className="text-body2 opacity-80">{time}</span>
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('support.incomingCollapse')}
            className="-mr-1 shrink-0 cursor-pointer rounded-sm p-1 transition-colors hover:bg-white/20"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="flex gap-4 px-5 pt-5">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-support-01/30" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-support-01 text-body1 text-ui-01">
              {call.callerLogin.slice(0, 1).toUpperCase()}
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-body1 text-ui-06"
              title={call.callerLogin}
            >
              {call.callerLogin}
            </p>

            {call.subject && (
              <p
                className="mt-1 line-clamp-2 text-body2 text-ui-05"
                title={call.subject}
              >
                {call.subject}
              </p>
            )}

            {call.page && (
              <p className="mt-1 truncate text-body2 text-ui-03">{call.page}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-5">
          <button
            type="button"
            onClick={onAnswer}
            className="flex-1 cursor-pointer rounded-md bg-accent-01 py-2.5 text-body2 text-ui-06 transition-all hover:bg-accent-01-hover hover:shadow-primary-hover active:bg-accent-01-pressed active:shadow-none"
          >
            {t('support.answer')}
          </button>
          {moreWaiting > 0 && (
            <button
              type="button"
              onClick={onOpenQueue}
              className="cursor-pointer rounded-md bg-ui-02 px-4 py-2.5 text-body2 whitespace-nowrap text-ui-06 transition-colors hover:bg-ui-04"
            >
              {t('support.incomingMore', { count: moreWaiting })}
            </button>
          )}
        </div>
      </div>
    </Grow>
  )
}

import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
  keyframes,
} from '@mui/material'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'

import type { SupportCall, SupportCallSession } from '../model/types'
import {
  useActiveSupportSession,
  useJoinSupportCall,
  useStartSupportCall,
  useSupportQueue,
} from '../model/use-support-call'
import { CallRoomDialog } from './call-room-dialog'
import { IncomingCallCard } from './incoming-call-card'

/**
 * Пульсация кнопки при входящем звонке.
 *
 * <p>Одного счётчика мало: агент смотрит в документ, а не на угол экрана, и статичный бейдж
 * замечают не сразу. Движение видно боковым зрением — это и есть смысл сигнала.
 */
const ring = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7); }
  70%  { box-shadow: 0 0 0 18px rgba(211, 47, 47, 0); }
  100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
`

/** То же для возврата в разговор — тень под цвет кнопки, иначе зелёное светится красным. */
const ringBack = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.7); }
  70%  { box-shadow: 0 0 0 18px rgba(46, 125, 50, 0); }
  100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
`

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

  if (!user) return null

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 80,
          zIndex: (theme) => theme.zIndex.speedDial,
        }}
      >
        {/* Возврат в разговор — состояние ТОЙ ЖЕ кнопки, а не вторая плашка рядом.
            Отдельный элемент выглядел чужеродно и занимал место постоянно, хотя нужен
            в редком случае: вкладку перезагрузили посреди звонка. */}
        {restoreAvailable && restored ? (
          <Tooltip title={t('support.restoring')} placement="left">
            <Fab
              color="success"
              size="medium"
              onClick={() => {
                setSession(restored)
              }}
              sx={{ animation: `${ringBack} 1.4s ease-out infinite` }}
            >
              <PhoneInTalkIcon />
            </Fab>
          </Tooltip>
        ) : isAgent ? (
          <SupportQueueButton
            onOpen={() => {
              setQueueOpen(true)
            }}
            onAnswer={setSession}
          />
        ) : (
          <Tooltip title={t('support.fabCall')} placement="left">
            <Fab
              color="primary"
              size="medium"
              onClick={() => {
                setCallerOpen(true)
              }}
            >
              <HeadsetMicIcon />
            </Fab>
          </Tooltip>
        )}
      </Box>

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
          onClose={() => {
            setSession(null)
            // Разговор закрыт осознанно — предлагать вернуться в него больше не нужно.
            // Без этого кнопка «вернуться» появлялась снова сразу после выхода: ответ
            // сервера про активный разговор лежит в кеше и сам по себе не пересматривается.
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
 * <p>Три состояния, а не два: нет обращений — обычная кнопка; кто-то ждёт — красная,
 * пульсирующая, с иконкой звонка и счётчиком; разговоры идут, но никто не ждёт — спокойная
 * кнопка со счётчиком активных. Пульсация привязана именно к ОЖИДАЮЩИМ: она означает
 * «нужно ответить», а не «что-то происходит».
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
    <Tooltip
      title={ringing ? t('support.fabIncoming') : t('support.fabQueue')}
      placement="left"
    >
      <Badge
        badgeContent={waiting || calls.length}
        color="error"
        overlap="circular"
      >
        <Fab
          color={ringing ? 'error' : 'primary'}
          size="medium"
          onClick={onOpen}
          sx={
            ringing
              ? { animation: `${ring} 1.4s ease-out infinite` }
              : undefined
          }
        >
          {ringing ? <PhoneInTalkIcon /> : <SupportAgentIcon />}
        </Fab>
      </Badge>
    </Tooltip>
  )
}

interface DialogProps {
  onClose: () => void
  onConnected: (session: SupportCallSession) => void
}

/**
 * Звонок пользователя.
 *
 * <p>Согласие на запись спрашивается ДО звонка: сервер без него отвечает 400, когда запись
 * включена, — и это правильный порядок, потому что в записи оказываются персональные данные.
 */
const CallerDialog = ({ onClose, onConnected }: DialogProps) => {
  const { t } = useTranslation()
  const location = useLocation()
  const [subject, setSubject] = useState('')
  const [consent, setConsent] = useState(false)
  const { mutate, isPending, error } = useStartSupportCall()

  const call = () => {
    mutate(
      {
        subject: subject.trim() || undefined,
        recordingConsent: consent,
        page: location.pathname,
      },
      { onSuccess: onConnected }
    )
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('support.dialogTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {Boolean(error) && (
            <Alert severity="error">{t('support.error')}</Alert>
          )}

          <TextField
            label={t('support.subject')}
            placeholder={t('support.subjectPlaceholder')}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value)
            }}
            multiline
            minRows={2}
            fullWidth
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked)
                }}
              />
            }
            label={t('support.consent')}
          />

          <Typography variant="caption" color="text.secondary">
            {t('support.privacyNote')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.cancel')}</Button>
        <Button
          variant="contained"
          onClick={call}
          disabled={isPending || !consent}
        >
          {isPending ? t('support.connecting') : t('support.callAction')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Очередь обращений.
 *
 * <p>Ожидающие идут первыми — их отдаёт сервер в этом порядке. Уже взятые обращения из списка
 * не исчезают: агенту нужно видеть, что происходит у смены, и вернуться в свой разговор,
 * если он закрыл вкладку.
 */
const SupportQueueDialog = ({ onClose, onConnected }: DialogProps) => {
  const { t, i18n } = useTranslation()
  const { data, isLoading } = useSupportQueue(true)
  const { mutate, isPending, error } = useJoinSupportCall()
  const calls = data ?? []

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
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('support.queueTitle')}</DialogTitle>
      <DialogContent>
        {Boolean(error) && <Alert severity="error">{t('support.error')}</Alert>}

        {isLoading && (
          <Typography variant="body2">{t('support.queueLoading')}</Typography>
        )}

        {!isLoading && calls.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('support.queueEmpty')}
          </Typography>
        )}

        <List>
          {calls.map((call) => (
            <ListItemButton
              key={call.id}
              disabled={isPending}
              onClick={() => {
                mutate(call.id, { onSuccess: onConnected })
              }}
            >
              <ListItemText
                primary={`${call.callerLogin}${call.subject ? ` — ${call.subject}` : ''}`}
                secondary={secondary(call)}
              />
              {call.status === 'WAITING' && (
                <Chip size="small" color="error" label={t('support.answer')} />
              )}
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

import CloseIcon from '@mui/icons-material/Close'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import {
  Avatar,
  Box,
  Button,
  Grow,
  IconButton,
  Paper,
  Stack,
  Typography,
  keyframes,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { SupportCall } from '../model/types'

/** Пульсация аватара — тот же смысл, что у кнопки: «звонок ждёт ответа». */
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.6); }
  70%  { box-shadow: 0 0 0 14px rgba(211, 47, 47, 0); }
  100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
`

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
      <Paper
        elevation={8}
        sx={{ width: 320, borderRadius: 3, overflow: 'hidden' }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 2,
            py: 1,
            bgcolor: 'error.main',
            color: 'error.contrastText',
          }}
        >
          <PhoneInTalkIcon fontSize="small" />
          <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {t('support.incomingTitle')}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {time}
          </Typography>
          <IconButton
            size="small"
            onClick={onCollapse}
            aria-label={t('support.incomingCollapse')}
            sx={{ color: 'inherit' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ p: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'error.main',
              animation: `${pulse} 1.4s ease-out infinite`,
            }}
          >
            {call.callerLogin.slice(0, 1).toUpperCase()}
          </Avatar>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
              variant="body1"
              fontWeight={600}
              noWrap
              title={call.callerLogin}
            >
              {call.callerLogin}
            </Typography>

            {call.subject && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title={call.subject}
              >
                {call.subject}
              </Typography>
            )}

            {call.page && (
              <Typography
                variant="caption"
                color="text.disabled"
                noWrap
                display="block"
              >
                {call.page}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2 }}>
          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={onAnswer}
          >
            {t('support.answer')}
          </Button>
          {moreWaiting > 0 && (
            <Button
              variant="outlined"
              onClick={onOpenQueue}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t('support.incomingMore', { count: moreWaiting })}
            </Button>
          )}
        </Stack>
      </Paper>
    </Grow>
  )
}

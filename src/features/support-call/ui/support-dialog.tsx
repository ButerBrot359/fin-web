import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import MinimizeIcon from '@mui/icons-material/Minimize'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import { Dialog } from '@mui/material'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { cn } from '@/shared/lib/utils/cn'

interface SupportDialogProps {
  title: string
  /** Строка под заголовком: с кем разговор, сколько ждут, что происходит. */
  subtitle?: ReactNode
  /** Справа от заголовка — индикатор записи и подобное. */
  headerSlot?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** `false`, когда окно не должно закрываться щелчком мимо и по Esc. */
  dismissable?: boolean
  /** Крестик. Не задаётся у окна разговора: закрыть его нельзя, можно только свернуть. */
  onClose?: () => void
  /**
   * Свернуть окно, не трогая его содержимое. Задаётся у окна разговора: соединение при этом
   * живёт дальше, поэтому сворачивание — не закрытие и не должно им выглядеть.
   */
  onMinimize?: () => void
  maxWidth?: 'sm' | 'lg'
  /** Окно растянуто на всё окно браузера. Кнопка разворота появляется только вместе с обработчиком. */
  expanded?: boolean
  onToggleExpanded?: () => void
  contentClassName?: string
}

/**
 * Общая рамка окон живой поддержки.
 *
 * <p>Скругление 40px, синяя тень и заголовок в 26px — те же, что у остальных диалогов webbuh
 * (см. `shared/ui/confirm-dialog`). Вынесено в один компонент намеренно: окна поддержки —
 * единственное место, куда пользователь попадает в момент, когда у него уже что-то не работает,
 * и выглядеть чужим оно должно меньше всего.
 *
 * <p>В развёрнутом виде окно занимает всё окно браузера, но остаётся окном: полноэкранный режим
 * ОС прячет вкладки и адресную строку, а человеку в разговоре с поддержкой обычно нужно
 * оставаться в webbuh, а не выпадать из него.
 *
 * <p>Крестик и сворачивание — разные вещи и рисуются раздельно. У окна разговора крестика нет
 * вовсе: закрыть разговор нажатием на «х» слишком легко, а стоит это обеим сторонам.
 */
export const SupportDialog = ({
  title,
  subtitle,
  headerSlot,
  children,
  footer,
  dismissable = true,
  onClose,
  onMinimize,
  maxWidth = 'sm',
  expanded = false,
  onToggleExpanded,
  contentClassName,
}: SupportDialogProps) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open
      fullWidth
      maxWidth={expanded ? false : maxWidth}
      // Щелчок мимо и Esc сворачивают окно разговора, а не закрывают его: разговор при этом
      // не прерывается, так что случайное движение мышью ничего не стоит.
      onClose={onMinimize ?? (dismissable ? onClose : undefined)}
      slotProps={{
        paper: {
          sx: {
            borderRadius: expanded ? '24px' : '40px',
            boxShadow: '0px 3px 24px 0px rgba(42, 117, 244, 0.4)',
            m: 2,
            ...(expanded && {
              width: 'calc(100% - 32px)',
              maxWidth: 'calc(100% - 32px)',
              height: 'calc(100% - 32px)',
              maxHeight: 'calc(100% - 32px)',
            }),
          },
        },
      }}
    >
      <div
        className={cn(
          'flex flex-col gap-6',
          expanded ? 'h-full px-8 py-6' : 'px-10 py-8'
        )}
      >
        <div className="flex w-full items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-h2 leading-normal text-ui-06">{title}</h2>
            {subtitle !== undefined && (
              <div className="mt-1 text-body2 text-ui-05">{subtitle}</div>
            )}
          </div>

          {headerSlot}

          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              aria-label={t('support.minimize')}
              title={t('support.minimize')}
              className="mt-1 shrink-0 cursor-pointer rounded-md p-1 text-ui-06 transition-colors hover:bg-ui-04"
            >
              <MinimizeIcon sx={{ fontSize: 20 }} />
            </button>
          )}

          {onToggleExpanded && (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-label={t(expanded ? 'support.collapse' : 'support.expand')}
              title={t(expanded ? 'support.collapse' : 'support.expand')}
              className="mt-1 shrink-0 cursor-pointer rounded-md p-1 text-ui-06 transition-colors hover:bg-ui-04"
            >
              {expanded ? (
                <CloseFullscreenIcon sx={{ fontSize: 20 }} />
              ) : (
                <OpenInFullIcon sx={{ fontSize: 20 }} />
              )}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('actions.close')}
              className="mt-1 shrink-0 cursor-pointer rounded-md p-1 transition-colors hover:bg-ui-04"
            >
              <CrossIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        <div
          className={cn(
            'min-w-0',
            expanded && 'min-h-0 flex-1',
            contentClassName
          )}
        >
          {children}
        </div>

        {footer}
      </div>
    </Dialog>
  )
}

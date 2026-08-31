import TouchAppIcon from '@mui/icons-material/TouchApp'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Плашка «вами управляют» (ADR-0050).
 *
 * <p><b>Видна всё время, пока управление разрешено, и не сворачивается.</b> Единственная опасная
 * ситуация здесь — человек забыл, что дал доступ, и ушёл работать со своей бухгалтерией, пока
 * ей управляет кто-то ещё. Поэтому плашка занимает верх экрана и не убирается ничем, кроме
 * отзыва управления.
 *
 * <p>Забрать управление можно кнопкой и клавишей Esc. Esc здесь — не украшение: когда на экране
 * происходит не то, рука тянется к ней раньше, чем глаз находит кнопку.
 */
export const RemoteControlBanner = ({ onRevoke }: { onRevoke: () => void }) => {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onRevoke()
      }
    }
    // capture: перехватываем раньше остальных обработчиков — Esc обязан сработать даже когда
    // открыт диалог, который обычно забирает эту клавишу себе.
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onRevoke])

  return (
    <div className="fixed inset-x-0 top-0 z-[1400] flex items-center justify-center gap-3 bg-support-01 px-4 py-2 text-ui-01 shadow-[0px_3px_16px_0px_rgba(244,72,42,0.5)]">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ui-01" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ui-01" />
      </span>

      <TouchAppIcon sx={{ fontSize: 18 }} />
      <span className="text-body2">{t('support.controlActive')}</span>

      <button
        type="button"
        onClick={onRevoke}
        className="cursor-pointer rounded-md bg-ui-01 px-3 py-1 text-body2 text-support-01 transition-all hover:brightness-95"
      >
        {t('support.controlRevoke')}
      </button>
    </div>
  )
}

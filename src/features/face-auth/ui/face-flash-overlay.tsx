import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import type { FaceCaptureState } from '../lib/hooks/use-face-capture'

interface FaceFlashOverlayProps {
  state: FaceCaptureState
}

/**
 * Полноэкранная световая заливка и превью камеры на время проверки (ADR-0069 §D11).
 *
 * <b>Заливка занимает весь видимый вьюпорт, и это не оформительское решение.</b> Экран здесь —
 * единственный источник света: сервер измеряет, как кожа откликается на смену цвета, а маленький
 * цветной прямоугольник лицо попросту не осветит. Уменьшить заливку ради «аккуратности» значит
 * обнулить сигнал и получить отказ у живого человека.
 *
 * Элемент видео отдаётся наружу через ref: им управляет {@link useFaceCapture}, который и снимает
 * кадры. Здесь видео только показывается пользователю, чтобы он видел, попал ли в кадр.
 */
export const FaceFlashOverlay = forwardRef<
  HTMLVideoElement,
  FaceFlashOverlayProps
>(({ state }, videoRef) => {
  const { t } = useTranslation()

  const isActive =
    state.phase === 'capturing' ||
    state.phase === 'uploading' ||
    state.phase === 'startingCamera'

  if (!isActive) {
    return null
  }

  return (
    <div
      // Заливка на весь вьюпорт. Во время загрузки цвета уже нет — держим нейтральный тёмный,
      // чтобы экран не мигал белым в момент, когда съёмка закончилась.
      style={{ backgroundColor: state.fillColor ?? '#1f1f1f' }}
      className="fixed inset-0 z-[1300] flex flex-col items-center justify-center gap-6"
      role="status"
      aria-live="polite"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        // Зеркалим ТОЛЬКО превью и только средствами CSS: людям привычно видеть себя зеркально.
        // На кадры, уходящие на сервер, это не влияет — они снимаются с исходного видеопотока
        // (см. grabFrame), а любая постобработка изменила бы то, что сервер измеряет.
        className="h-40 w-40 scale-x-[-1] rounded-full object-cover shadow-lg ring-4 ring-white/70"
      />

      <Typography variant="body1" className="text-center drop-shadow">
        {state.phase === 'uploading'
          ? t('auth.face.uploading')
          : t('auth.face.hint')}
      </Typography>

      <FaceCaptureProgress state={state} />
    </div>
  )
})

FaceFlashOverlay.displayName = 'FaceFlashOverlay'

/**
 * Прогресс проверки — именно полоса, а не «крутилка» (§D11).
 *
 * Причина конкретная и измеренная: на остывшем движке распознавания ответ приходит через 8–10
 * секунд. Крутилку за это время принимают за зависание и жмут кнопку повторно — а повтор
 * израсходует второй челлендж и вторую попытку из пяти, то есть человек приблизится к
 * блокировке, ничего не сделав неправильно.
 */
const FaceCaptureProgress = ({ state }: { state: FaceCaptureState }) => {
  const { t } = useTranslation()

  const percent = Math.round(state.progress * 100)
  const label =
    state.phase === 'startingCamera'
      ? t('auth.face.startingCamera')
      : state.phase === 'uploading'
        ? t('auth.face.uploading')
        : t('auth.face.capturing')

  return (
    <div className="flex w-64 flex-col items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/40">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      <Typography variant="caption" className="drop-shadow">
        {label}
      </Typography>
    </div>
  )
}

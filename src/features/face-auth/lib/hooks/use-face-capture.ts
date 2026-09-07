import { useCallback, useRef, useState } from 'react'

import {
  requestFaceChallenge,
  verifyFaceSeries,
} from '../../api/face-auth-endpoints'
import type {
  CapturedFrame,
  FaceChallengeResponse,
  FaceVerifyOutcome,
} from '../../types/face-auth'
import {
  CameraAccessError,
  grabFrame,
  readCapabilities,
  startCamera,
  stopCamera,
  subscribeToFrames,
} from '../camera'
import {
  baselineStartMs,
  buildFlashTimeline,
  isFrameWithinCaptureWindow,
  segmentIndexAt,
  timelineDurationMs,
} from '../flash-timeline'

/** Фазы попытки — по ним UI решает, что рисовать и что заблокировать. */
export type FaceCapturePhase =
  | 'idle'
  | 'requestingChallenge'
  | 'startingCamera'
  | 'capturing'
  | 'uploading'
  | 'done'

export interface FaceCaptureState {
  phase: FaceCapturePhase
  /** Текущий цвет заливки вьюпорта, `null` вне съёмки. */
  fillColor: string | null
  /** Доля выполненной съёмки 0..1 — для прогресса, а не «крутилки» (§D11). */
  progress: number
  outcome: FaceVerifyOutcome | null
}

const INITIAL_STATE: FaceCaptureState = {
  phase: 'idle',
  fillColor: null,
  progress: 0,
  outcome: null,
}

/**
 * Оркестрация одной попытки входа по лицу (ADR-0069 §D11).
 *
 * Последовательность жёсткая: челлендж → камера → съёмка по расписанию → отправка. Расписание
 * исполняется как есть — сервер измеряет временну́ю корреляцию между назначенным цветом и
 * откликом кожи, и любая наша самодеятельность в таймингах читается им как «неживой».
 *
 * ПОВТОРНЫЙ ЗАПУСК ЗАПРЕЩЁН, пока идёт текущая попытка. Это не удобство, а защита пользователя:
 * на остывшем движке ответ приходит через 8–10 секунд, и второе нажатие израсходовало бы второй
 * челлендж и вторую попытку из пяти — человек приблизился бы к блокировке, ничего не сделав
 * неправильно (§D8.2, §D13).
 */
export function useFaceCapture(
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const [state, setState] = useState<FaceCaptureState>(INITIAL_STATE)
  const runningRef = useRef(false)

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const run = useCallback(
    async (login: string): Promise<FaceVerifyOutcome> => {
      if (runningRef.current) {
        return { kind: 'clientError', detail: 'already-running' }
      }
      runningRef.current = true

      let stream: MediaStream | null = null
      try {
        setState({ ...INITIAL_STATE, phase: 'requestingChallenge' })
        const challenge = await requestFaceChallenge(login)

        setState((prev) => ({ ...prev, phase: 'startingCamera' }))
        stream = await startCamera(challenge.capture)
        const video = videoRef.current
        if (!video) {
          throw new CameraAccessError('Нет элемента видео', 'NotAttachedError')
        }
        video.srcObject = stream
        await video.play()

        // Возможности читаются здесь, на живом потоке. После stopCamera дорожка переходит в
        // состояние "ended", и getCapabilities возвращает пустоту — калибровка осталась бы без
        // сведений о железе, на котором снималась серия, причём молча.
        const capabilities = readCapabilities(stream)

        const frames = await captureSeries(
          video,
          challenge,
          (progress, fillColor) => {
            setState((prev) => ({
              ...prev,
              phase: 'capturing',
              progress,
              fillColor,
            }))
          }
        )

        setState((prev) => ({
          ...prev,
          phase: 'uploading',
          fillColor: null,
          progress: 1,
        }))

        // Камера гасится ДО отправки: индикатор записи не должен гореть, пока сервер думает
        // свои 8–10 секунд на остывшем движке.
        stopCamera(stream)
        stream = null

        const outcome = await verifyFaceSeries(
          challenge.challengeId,
          {
            frames: frames.map((f) => f.meta),
            capabilities,
            screen: {
              w: window.screen.width,
              h: window.screen.height,
              dpr: window.devicePixelRatio,
            },
          },
          frames
        )

        setState((prev) => ({ ...prev, phase: 'done', outcome }))
        return outcome
      } catch (error) {
        const outcome: FaceVerifyOutcome =
          error instanceof CameraAccessError
            ? { kind: 'clientError', detail: error.reason }
            : { kind: 'clientError', detail: String(error) }
        setState({ ...INITIAL_STATE, phase: 'done', outcome })
        return outcome
      } finally {
        stopCamera(stream)
        runningRef.current = false
      }
    },
    [videoRef]
  )

  return { state, run, reset }
}

/**
 * Снимает серию, отрисовывая заливку по расписанию.
 *
 * Заливкой управляет колбэк `onTick` — компонент красит вьюпорт. Кадры маркируются временем,
 * которое отдала камера, а не моментом обработки: под нагрузкой это разные величины, и вторая
 * приписала бы кадр следующему цвету.
 */
async function captureSeries(
  video: HTMLVideoElement,
  challenge: FaceChallengeResponse,
  onTick: (progress: number, fillColor: string) => void
): Promise<CapturedFrame[]> {
  const slots = buildFlashTimeline(challenge)
  const totalMs = timelineDurationMs(slots)
  const windowStart = baselineStartMs(challenge)

  const canvas = document.createElement('canvas')
  canvas.width = challenge.capture.width
  canvas.height = challenge.capture.height

  const frames: CapturedFrame[] = []
  const pending: Promise<void>[] = []
  let n = 0

  return new Promise((resolve) => {
    const subscription = subscribeToFrames(
      video,
      challenge.capture.targetFps,
      (frameTimeMs) => {
        const seg = segmentIndexAt(slots, frameTimeMs)
        if (seg === null) {
          subscription.stop()
          void Promise.all(pending).then(() => {
            resolve(frames)
          })
          return
        }

        const slot = slots.find((s) => s.seg === seg)
        onTick(Math.min(frameTimeMs / totalMs, 1), slot?.rgb ?? '#000000')

        if (!isFrameWithinCaptureWindow(slots, frameTimeMs, windowStart)) {
          return
        }
        if (frames.length + pending.length >= challenge.capture.maxFrames) {
          return
        }

        const meta = { n: n++, tMs: Math.round(frameTimeMs), seg }
        pending.push(
          grabFrame(video, canvas, challenge.capture.jpegQuality).then(
            (blob) => {
              if (blob) {
                frames.push({ meta, blob })
              }
            }
          )
        )
      }
    )
  })
}

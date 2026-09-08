import type { FaceChallengeResponse } from '../types/face-auth'

/**
 * Временная шкала светового расписания — чистая арифметика, отделённая от отрисовки.
 *
 * Отдельный модуль не ради красоты: сервер проверяет ВРЕМЕННУЮ корреляцию между тем, когда он
 * назначил цвет, и тем, когда лицо на него откликнулось. Ошибка в этой арифметике не падает и не
 * логируется — она приходит к пользователю как «вход не работает», а к разработчику как «низкая
 * корреляция». Поэтому шкала строится и проверяется тестами отдельно от `requestAnimationFrame`,
 * который в тестах не воспроизвести.
 */

/** Индекс сегмента для кадров прогрева. Такой же приходит обратно в `meta.frames[].seg`. */
export const WARMUP_SEGMENT_INDEX = -1

export interface TimelineSlot {
  /** Индекс сегмента расписания; {@link WARMUP_SEGMENT_INDEX} для прогрева. */
  seg: number
  /** Цвет заливки `#RRGGBB`. */
  rgb: string
  /** Начало интервала от старта съёмки, мс (включительно). */
  startMs: number
  /** Конец интервала, мс (не включительно). */
  endMs: number
}

/**
 * Раскладывает челлендж в непрерывную шкалу: прогрев, затем сегменты подряд БЕЗ ПАУЗ.
 *
 * Пауз нет намеренно — любой зазор между сегментами это кадры, которые сервер не сможет отнести
 * ни к одному цвету, то есть выброшенные из корреляции данные.
 */
export function buildFlashTimeline(
  challenge: FaceChallengeResponse
): TimelineSlot[] {
  const slots: TimelineSlot[] = [
    {
      seg: WARMUP_SEGMENT_INDEX,
      rgb: challenge.warmupRgb,
      startMs: 0,
      endMs: challenge.warmupMs,
    },
  ]

  let cursor = challenge.warmupMs
  for (const segment of challenge.schedule) {
    slots.push({
      seg: segment.i,
      rgb: segment.rgb,
      startMs: cursor,
      endMs: cursor + segment.ms,
    })
    cursor += segment.ms
  }

  return slots
}

/** Полная длительность съёмки, мс — прогрев плюс все сегменты. */
export function timelineDurationMs(slots: TimelineSlot[]): number {
  return slots.length === 0 ? 0 : slots[slots.length - 1].endMs
}

/**
 * Какой слот действует в момент `tMs` от начала съёмки.
 *
 * `null` означает, что съёмка закончилась. Линейный поиск, а не бинарный: слотов всегда шесть
 * (прогрев + четыре цветных + закрывающий нейтральный), и понятность здесь дороже.
 */
export function slotAt(
  slots: TimelineSlot[],
  tMs: number
): TimelineSlot | null {
  for (const slot of slots) {
    if (tMs >= slot.startMs && tMs < slot.endMs) {
      return slot
    }
  }
  return null
}

/**
 * К какому сегменту отнести кадр, снятый в момент `tMs`.
 *
 * ВАЖНО: время берётся из метки кадра камеры (`requestVideoFrameCallback`), а НЕ из момента,
 * когда мы этот кадр обработали. Разница между ними — это задержка конвейера браузера, и она
 * тем больше, чем сильнее загружена машина. Отнеся кадр по времени обработки, мы бы приписали
 * его следующему цвету и своими руками испортили корреляцию, которую сервер проверяет.
 */
export function segmentIndexAt(
  slots: TimelineSlot[],
  tMs: number
): number | null {
  const slot = slotAt(slots, tMs)
  return slot === null ? null : slot.seg
}

/**
 * Нужно ли отправлять кадр, снятый в момент `tMs`.
 *
 * Отправляется не вся съёмка (§D11): последние `baselineFrames` кадров прогрева, все кадры
 * цветных сегментов и кадры закрывающего нейтрального. Ранний прогрев отбрасывается — там
 * камера ещё подстраивает экспозицию под новую заливку, и эти кадры только зашумили бы базовую
 * линию, относительно которой считается отклик.
 */
export function isFrameWithinCaptureWindow(
  slots: TimelineSlot[],
  tMs: number,
  baselineStartMs: number
): boolean {
  if (tMs < baselineStartMs) {
    return false
  }
  return slotAt(slots, tMs) !== null
}

/**
 * С какого момента прогрева начинать сохранять кадры.
 *
 * `baselineFrames` задан сервером в кадрах, а шкала — в миллисекундах, поэтому переводим через
 * ожидаемую частоту съёмки. Если прогрев короче требуемой базовой линии, берём его целиком:
 * лучше отдать меньше базовых кадров, чем не отдать ни одного.
 */
export function baselineStartMs(challenge: FaceChallengeResponse): number {
  const { warmupMs, capture } = challenge
  const baselineMs =
    (capture.baselineFrames / Math.max(capture.targetFps, 1)) * 1000
  return Math.max(0, warmupMs - baselineMs)
}

import { describe, expect, it } from 'vitest'

import type { FaceChallengeResponse } from '../types/face-auth'
import {
  WARMUP_SEGMENT_INDEX,
  baselineStartMs,
  buildFlashTimeline,
  isFrameWithinCaptureWindow,
  segmentIndexAt,
  slotAt,
  timelineDurationMs,
} from './flash-timeline'

const challenge = (
  overrides: Partial<FaceChallengeResponse> = {}
): FaceChallengeResponse => ({
  challengeId: 'test',
  expiresInSeconds: 60,
  warmupMs: 900,
  warmupRgb: '#808080',
  schedule: [
    { i: 0, rgb: '#FF0000', ms: 267 },
    { i: 1, rgb: '#00FF00', ms: 333 },
    { i: 2, rgb: '#0000FF', ms: 250 },
    { i: 3, rgb: '#FFFF00', ms: 383 },
    { i: 4, rgb: '#808080', ms: 300 },
  ],
  capture: {
    width: 640,
    height: 480,
    jpegQuality: 0.85,
    targetFps: 15,
    minFrames: 24,
    maxFrames: 48,
    baselineFrames: 3,
  },
  ...overrides,
})

describe('buildFlashTimeline', () => {
  it('ставит прогрев первым слотом', () => {
    const slots = buildFlashTimeline(challenge())

    expect(slots[0]).toMatchObject({
      seg: WARMUP_SEGMENT_INDEX,
      rgb: '#808080',
      startMs: 0,
      endMs: 900,
    })
  })

  it('раскладывает сегменты подряд без зазоров', () => {
    // Зазор между сегментами — это кадры, которые сервер не отнесёт ни к одному цвету и
    // выбросит из корреляции. Проверяем стык каждой пары, а не только итоговую длительность:
    // ошибка в накоплении курсора дала бы верную сумму при разъехавшихся границах.
    const slots = buildFlashTimeline(challenge())

    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i].startMs).toBe(slots[i - 1].endMs)
    }
  })

  it('сохраняет индексы и цвета сегментов ровно как прислал сервер', () => {
    const slots = buildFlashTimeline(challenge()).slice(1)

    expect(slots.map((s) => s.seg)).toEqual([0, 1, 2, 3, 4])
    expect(slots.map((s) => s.rgb)).toEqual([
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#FFFF00',
      '#808080',
    ])
  })

  it('считает полную длительность как прогрев плюс сегменты', () => {
    expect(timelineDurationMs(buildFlashTimeline(challenge()))).toBe(
      900 + 267 + 333 + 250 + 383 + 300
    )
  })
})

describe('slotAt', () => {
  const slots = buildFlashTimeline(challenge())

  it('относит момент начала сегмента к нему самому, а не к предыдущему', () => {
    // Граница включительна слева и исключительна справа. Ошибка здесь сдвигает ВСЕ кадры на
    // один сегмент — сервер увидит систематический сдвиг фазы и откажет, хотя человек живой.
    expect(slotAt(slots, 900)?.seg).toBe(0)
    expect(slotAt(slots, 899)?.seg).toBe(WARMUP_SEGMENT_INDEX)
  })

  it('относит последний миллисекундный момент сегмента к нему же', () => {
    expect(slotAt(slots, 900 + 267 - 1)?.seg).toBe(0)
    expect(slotAt(slots, 900 + 267)?.seg).toBe(1)
  })

  it('возвращает null после конца съёмки', () => {
    expect(slotAt(slots, timelineDurationMs(slots))).toBeNull()
    expect(slotAt(slots, timelineDurationMs(slots) + 1000)).toBeNull()
  })

  it('возвращает null для отрицательного времени', () => {
    expect(slotAt(slots, -1)).toBeNull()
  })
})

describe('segmentIndexAt', () => {
  const slots = buildFlashTimeline(challenge())

  it('даёт -1 на прогреве и индекс сегмента на цветной части', () => {
    expect(segmentIndexAt(slots, 0)).toBe(WARMUP_SEGMENT_INDEX)
    expect(segmentIndexAt(slots, 950)).toBe(0)
    expect(segmentIndexAt(slots, 1250)).toBe(1)
  })

  it('даёт null после конца съёмки', () => {
    expect(segmentIndexAt(slots, 99_999)).toBeNull()
  })
})

describe('baselineStartMs', () => {
  it('отступает от конца прогрева ровно на baselineFrames кадров', () => {
    // 3 кадра при 15 fps = 200 мс, прогрев 900 мс → базовая линия начинается на 700 мс.
    expect(baselineStartMs(challenge())).toBe(700)
  })

  it('берёт прогрев целиком, если он короче требуемой базовой линии', () => {
    // Иначе получилось бы отрицательное начало окна, и в отправку не попал бы ни один
    // базовый кадр — сервер остался бы без уровня, относительно которого считает отклик.
    const short = challenge({ warmupMs: 100 })

    expect(baselineStartMs(short)).toBe(0)
  })

  it('не делит на ноль при нулевой целевой частоте', () => {
    const broken = challenge({
      capture: { ...challenge().capture, targetFps: 0 },
    })

    expect(Number.isFinite(baselineStartMs(broken))).toBe(true)
  })
})

describe('isFrameWithinCaptureWindow', () => {
  const c = challenge()
  const slots = buildFlashTimeline(c)
  const start = baselineStartMs(c)

  it('отбрасывает ранний прогрев', () => {
    // Там камера ещё подстраивает экспозицию под заливку — эти кадры зашумили бы базовую линию.
    expect(isFrameWithinCaptureWindow(slots, 0, start)).toBe(false)
    expect(isFrameWithinCaptureWindow(slots, 699, start)).toBe(false)
  })

  it('берёт последние кадры прогрева и всю цветную часть', () => {
    expect(isFrameWithinCaptureWindow(slots, 700, start)).toBe(true)
    expect(isFrameWithinCaptureWindow(slots, 1500, start)).toBe(true)
  })

  it('отбрасывает кадры после конца съёмки', () => {
    expect(
      isFrameWithinCaptureWindow(slots, timelineDurationMs(slots), start)
    ).toBe(false)
  })
})

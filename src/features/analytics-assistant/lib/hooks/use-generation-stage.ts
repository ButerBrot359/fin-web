import { useEffect, useState } from 'react'

/**
 * Этапы генерации, в порядке выполнения. Ключи и тайминги лежат рядом: это
 * описание одного и того же процесса, и разъехаться они не должны.
 */
export const GENERATION_STAGE_KEYS = [
  'analytics.assistant.stageSchema',
  'analytics.assistant.stageQuery',
  'analytics.assistant.stageValidate',
] as const

/**
 * Начало каждого этапа от старта генерации, мс.
 *
 * Сервер отвечает одним ответом в конце — промежуточных событий нет, поэтому
 * этапы переключаются по таймеру, подобранному под реальные длительности:
 * подбор витрин занимает ≈12 с, генерация спецификации ≈50 с, дальше идёт
 * проверка запроса на данных.
 */
const STAGE_STARTS_MS = [0, 12_000, 62_000]

/**
 * Индекс текущего этапа генерации.
 *
 * Последний этап сам не «дозакрывается»: пока ответа нет, остаёмся на нём.
 * Показывать завершение, которого никто не подтверждал, — враньё; проценты и
 * оценку оставшегося времени не показываем по той же причине.
 */
export const useGenerationStage = (isActive: boolean): number => {
  const [stage, setStage] = useState(0)
  const [wasActive, setWasActive] = useState(isActive)

  // Сброс на первый этап при выключении делаем в рендере, а не в эффекте:
  // эффект дал бы лишний проход, в котором список ещё показывает этап от
  // предыдущей генерации.
  if (isActive !== wasActive) {
    setWasActive(isActive)
    if (!isActive) {
      setStage(0)
    }
  }

  useEffect(() => {
    if (!isActive) {
      return
    }

    const timers = STAGE_STARTS_MS.slice(1).map((delay, index) =>
      window.setTimeout(() => {
        setStage(index + 1)
      }, delay)
    )

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer)
      })
    }
  }, [isActive])

  return stage
}

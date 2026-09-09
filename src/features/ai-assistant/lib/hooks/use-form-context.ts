import { useLocation } from 'react-router-dom'

import type { AiAssistantContext } from '@/entities/ai-assistant'

/**
 * Открытая карточка документа: `/modules/{pageCode}/document/{typeCode}/{entryId}`.
 *
 * Числовой хвост обязателен — он отсекает `/new`, где документа ещё нет. Это не
 * придирка: у несохранённой карточки нет идентификатора, а сервер читает данные
 * именно по нему и на `new` вернул бы пустоту, только позже и с ошибкой в логе.
 */
const DOCUMENT_ROUTE = /^\/modules\/[^/]+\/document\/([^/]+)\/(\d+)$/

const NO_CONTEXT: AiAssistantContext = { kind: 'NONE' }

/**
 * Контекст формы для помощника — вид объекта и идентификатор, но НЕ содержимое.
 *
 * Содержимое сервер читает сам: клиент, присылающий суммы и ФИО, стал бы способом
 * приписать себе чужие данные, и проверка прав этого бы не заметила.
 *
 * Контекст берётся из адреса, а не из состояния формы: адрес — единственное, что
 * одинаково доступно и легаси-карточкам, и SDUI, и что не требует связывать
 * помощника с внутренним состоянием чужих экранов.
 */
export const useFormContext = (): AiAssistantContext => {
  const { pathname } = useLocation()
  const match = DOCUMENT_ROUTE.exec(pathname)

  if (!match) return NO_CONTEXT

  return {
    kind: 'DOCUMENT',
    typeCode: match[1],
    entryId: Number(match[2]),
  }
}

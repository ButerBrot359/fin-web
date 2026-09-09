import { useLocation } from 'react-router-dom'

import type { AiAssistantContext } from '@/entities/ai-assistant'

/**
 * Где сейчас находится пользователь — из адреса.
 *
 * <p>Разбираются ОБА семейства маршрутов: модульное `/modules/{m}/document/{T}/{id}` и
 * плоское `/documents/{T}/{id}`. Первая версия знала только модульное и требовала числовой
 * идентификатор, поэтому в половине карточек помощник честно отвечал «документ не открыт»,
 * стоя внутри документа. Список семейств взят из `tab-entity-key.ts` — там он уже описан
 * для вкладок рабочей области, и расходиться им нельзя.
 *
 * <p>Список и новая карточка — тоже контекст, а не его отсутствие. Тип документа из адреса
 * уже известен, и на «создай новый» помощнику не придётся выспрашивать, какой именно:
 * сервер положит в промпт реквизиты этого типа.
 */
interface RoutePattern {
  regex: RegExp
  kind: AiAssistantContext['kind']
  /**
   * У маршрута есть группа идентификатора.
   *
   * Флагом, а не проверкой `match[2] === undefined`: при выключенном
   * `noUncheckedIndexedAccess` TypeScript считает элемент массива всегда строкой,
   * и сравнение с `undefined` линтер справедливо называет лишним.
   */
  hasEntry: boolean
}

const PATTERNS: RoutePattern[] = [
  // Движения документа — это всё ещё тот же документ.
  {
    regex: /^\/(?:modules\/[^/]+\/)?documents?\/([^/]+)\/([^/]+)\/movements$/,
    kind: 'DOCUMENT',
    hasEntry: true,
  },
  {
    regex: /^\/(?:modules\/[^/]+\/)?documents?\/([^/]+)\/([^/]+)$/,
    kind: 'DOCUMENT',
    hasEntry: true,
  },
  {
    regex: /^\/(?:modules\/[^/]+\/)?documents?\/([^/]+)$/,
    kind: 'DOCUMENT_LIST',
    hasEntry: false,
  },
  {
    regex: /^\/(?:modules\/[^/]+\/)?dictionar(?:y|ies)\/([^/]+)\/([^/]+)$/,
    kind: 'DICTIONARY',
    hasEntry: true,
  },
  {
    regex: /^\/(?:modules\/[^/]+\/)?dictionar(?:y|ies)\/([^/]+)$/,
    kind: 'DICTIONARY_LIST',
    hasEntry: false,
  },
]

const NO_CONTEXT: AiAssistantContext = { kind: 'NONE' }

/**
 * Контекст формы для помощника — вид объекта и идентификатор, но НЕ содержимое.
 *
 * <p>Содержимое сервер читает сам: клиент, присылающий суммы и ФИО, стал бы способом
 * приписать себе чужие данные, и проверка прав этого бы не заметила.
 */
export const useFormContext = (): AiAssistantContext => {
  const { pathname } = useLocation()

  for (const { regex, kind, hasEntry } of PATTERNS) {
    const match = regex.exec(pathname)
    if (!match) continue

    const typeCode = match[1]
    if (!hasEntry) {
      return { kind, typeCode, entryId: null }
    }

    const rawId = match[2]
    // `new` — несохранённая карточка: идентификатора ещё нет, но тип уже известен,
    // и это лучший момент помочь с заполнением.
    if (rawId === 'new') {
      return { kind: 'DOCUMENT_NEW', typeCode }
    }

    const entryId = Number(rawId)
    if (Number.isNaN(entryId)) {
      // Нечисловой хвост — это не запись, а какой-то подраздел. Тип всё равно знаем.
      return {
        kind: kind === 'DOCUMENT' ? 'DOCUMENT_LIST' : 'DICTIONARY_LIST',
        typeCode,
        entryId: null,
      }
    }

    return { kind, typeCode, entryId }
  }

  return NO_CONTEXT
}

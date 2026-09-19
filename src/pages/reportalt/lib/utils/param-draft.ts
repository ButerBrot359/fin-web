import type { ReportAltParameterDto } from '../../types/reportalt'
import { serializeParams, type ParamValues } from './params'

/**
 * Черновик параметров отчёта на время сессии вкладки.
 *
 * <p><b>Зачем.</b> Форма параметров восстанавливается ТОЛЬКО из URL, а в URL попадает
 * лишь то, что уже применено кнопкой «Сформировать». Набранный, но не применённый отбор
 * при уходе с вкладки (открыть счёт к оплате, посмотреть поставщика — и назад) пропадал
 * целиком, и его приходилось набирать заново (жалоба со стенда 19.09.2026 по 5-15).
 *
 * <p>Хранилище — {@link sessionStorage}: черновик живёт ровно столько, сколько вкладка
 * браузера, и не тянется в следующий рабочий день как «залипший» отбор. Ключ — код отчёта,
 * поэтому черновики разных отчётов не перетирают друг друга.
 *
 * <p>Формат значений — тот же, что у URL ({@code serializeParams}/{@code deserializeParam}),
 * поэтому у черновика и applied-параметров одна и та же семантика разбора.
 */
const KEY_PREFIX = 'reportalt-draft:'

const key = (moduleCode: string): string => KEY_PREFIX + moduleCode

/** Тихо: приватный режим/переполнение квоты не должны ронять страницу отчёта. */
function safeSession(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function saveParamDraft(moduleCode: string, values: ParamValues): void {
  const store = safeSession()
  if (!store || !moduleCode) return
  try {
    store.setItem(key(moduleCode), JSON.stringify(serializeParams(values)))
  } catch {
    // Квота или запрет записи — черновик просто не сохранится.
  }
}

/** Сериализованный черновик: `param.code` → строка того же вида, что в URL. */
export function readParamDraft(moduleCode: string): Record<string, string> {
  const store = safeSession()
  if (!store || !moduleCode) return {}
  try {
    const raw = store.getItem(key(moduleCode))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [code, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[code] = v
    }
    return out
  } catch {
    return {}
  }
}

export function clearParamDraft(moduleCode: string): void {
  const store = safeSession()
  if (!store || !moduleCode) return
  try {
    store.removeItem(key(moduleCode))
  } catch {
    // см. saveParamDraft
  }
}

/**
 * Сырое значение параметра для инициализации формы: применённое из URL, иначе
 * черновик, иначе {@code null} (вызывающий подставит дефолт).
 *
 * <p>URL главнее черновика: в нём то, по чему РЕАЛЬНО построена таблица на экране, и
 * поля обязаны ей соответствовать.
 */
export function initialParamRaw(
  param: ReportAltParameterDto,
  fromUrl: string | null,
  draft: Record<string, string>
): string | null {
  if (fromUrl != null) return fromUrl
  return draft[param.code] ?? null
}

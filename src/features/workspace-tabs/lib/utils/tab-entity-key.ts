/**
 * SCRUM-386 фикс 2 (дубли вкладок): одна и та же сущность доступна по двум
 * семействам URL — модульному (`/modules/{m}/document/{T}/{id}`) и плоскому
 * (`/documents/{T}/{id}`, SCRUM-360: плоские роуты больше не редиректятся).
 * Ключ нормализует путь до сущности; вкладки с одинаковым ключом — одна и та
 * же страница, вторую не создаём (activateOrCreate активирует существующую).
 * Модуль в ключ не входит намеренно: запись документа одна, из какого бы
 * раздела её ни открыли.
 */
import { formInstanceOf } from '@/shared/lib/router/form-instance-route'
import { isGroupCreate } from '@/shared/lib/router/group-create-route'

interface EntityPattern {
  regex: RegExp
  key: (m: RegExpExecArray) => string
}

const PATTERNS: EntityPattern[] = [
  // Модульные маршруты
  {
    regex: /^\/modules\/[^/]+\/document\/([^/]+)\/([^/]+)\/movements$/,
    key: (m) => `document-movements:${m[1]}:${m[2]}`,
  },
  {
    regex: /^\/modules\/[^/]+\/document\/([^/]+)\/([^/]+)$/,
    key: (m) =>
      m[2] === 'new' ? `document-new:${m[1]}` : `document:${m[1]}:${m[2]}`,
  },
  {
    regex: /^\/modules\/[^/]+\/document\/([^/]+)$/,
    key: (m) => `document-list:${m[1]}`,
  },
  {
    regex: /^\/modules\/[^/]+\/dictionary\/([^/]+)\/([^/]+)$/,
    key: (m) =>
      m[2] === 'new' ? `dictionary-new:${m[1]}` : `dictionary:${m[1]}:${m[2]}`,
  },
  {
    regex: /^\/modules\/[^/]+\/dictionary\/([^/]+)$/,
    key: (m) => `dictionary-list:${m[1]}`,
  },
  // Плоские маршруты (catch-all)
  {
    regex: /^\/documents\/([^/]+)\/([^/]+)\/movements$/,
    key: (m) => `document-movements:${m[1]}:${m[2]}`,
  },
  {
    regex: /^\/documents\/([^/]+)\/([^/]+)$/,
    key: (m) =>
      m[2] === 'new' ? `document-new:${m[1]}` : `document:${m[1]}:${m[2]}`,
  },
  {
    regex: /^\/documents\/([^/]+)$/,
    key: (m) => `document-list:${m[1]}`,
  },
  {
    regex: /^\/dictionaries\/([^/]+)\/([^/]+)$/,
    key: (m) =>
      m[2] === 'new' ? `dictionary-new:${m[1]}` : `dictionary:${m[1]}:${m[2]}`,
  },
  {
    regex: /^\/dictionaries\/([^/]+)$/,
    key: (m) => `dictionary-list:${m[1]}`,
  },
]

export function tabEntityKey(pathname: string, search = ''): string | null {
  for (const { regex, key } of PATTERNS) {
    const m = regex.exec(pathname)
    // SCRUM-360 v6 §6.3: «Создать группу» (?isGroup=true) — другая сущность,
    // чем «Создать» того же типа; ключи расходятся суффиксом.
    if (m) {
      const entity = isGroupCreate(search) ? `${key(m)}:group` : key(m)
      const instance = formInstanceOf(pathname, search)
      return instance ? `${entity}:${instance}` : entity
    }
  }
  return null
}

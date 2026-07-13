import type { ReactNode } from 'react'

// Inline-SVG: строгий CSP панелей блокирует сетевые ассеты,
// поэтому глифы вшиты в код. Неизвестное имя → null (кнопка
// деградирует до текста, никогда не пустая). Глифы — статичные
// ReactNode-константы, не компоненты: файл экспортирует только
// функцию, и react-refresh не ругается на смешанный экспорт.
const relatedHierarchyIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="7.25" y="2.25" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="2.25" y="13.75" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="12.25" y="13.75" width="5.5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M10 6.25v3.5M10 9.75H5v4M10 9.75h5v4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BUTTON_ICON_MAP: Record<string, ReactNode> = {
  'related-hierarchy': relatedHierarchyIcon,
}

/** Иконка по имени или null для неизвестного (кнопка деградирует до текста). */
export function resolveButtonIcon(name: string | undefined): ReactNode | null {
  if (!name || !Object.hasOwn(BUTTON_ICON_MAP, name)) return null
  return BUTTON_ICON_MAP[name]
}

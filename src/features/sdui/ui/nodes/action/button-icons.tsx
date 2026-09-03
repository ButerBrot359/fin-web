import type { ReactNode } from 'react'

import { figmaIcons } from '@/shared/ui/icons'

// Глифы — из Figma-реестра (@/shared/ui/icons, лист «Icons/20»); вшиты в
// бандл (строгий CSP панелей блокирует сетевые ассеты). Неизвестное имя →
// null (кнопка деградирует до текста, никогда не пустая). related-hierarchy
// остаётся рукодельным: в Figma нет глифа «иерархия связей» (ближайший
// «layers» 40:238 — семантически список, не иерархия).
const relatedHierarchyIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="7.25"
      y="2.25"
      width="5.5"
      height="4"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <rect
      x="2.25"
      y="13.75"
      width="5.5"
      height="4"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <rect
      x="12.25"
      y="13.75"
      width="5.5"
      height="4"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M10 6.25v3.5M10 9.75H5v4M10 9.75h5v4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Шеврон dropdown-кнопок («Печать ⌄») — глиф arrow-down из Figma (40:220),
// инлайном: svg-импорт не резолвится в vitest (svgr только в vite.config).
export const dropdownChevronIcon: ReactNode = (
  <svg
    width="13"
    height="7"
    viewBox="0 0 13 7"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M11.36 0.75 6.01 5.45 0.66 0.75"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const BUTTON_ICON_MAP: Record<string, ReactNode> = {
  'related-hierarchy': relatedHierarchyIcon,
  dtkt: figmaIcons['debet-kredit'],
  copy: figmaIcons.copy,
}

/** Иконка по имени или null для неизвестного (кнопка деградирует до текста). */
export function resolveButtonIcon(name: string | undefined): ReactNode | null {
  if (!name || !Object.hasOwn(BUTTON_ICON_MAP, name)) return null
  return BUTTON_ICON_MAP[name]
}

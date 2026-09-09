import type { ReactNode } from 'react'

import { cssVar, palette } from '@/shared/design/tokens'

// Иконки секции Icons -> «20» из Figma (fileKey 8RxAFhNubquQ1bz912H2wB),
// сконвертированы в inline-SVG по образцу button-icons.tsx: атрибуты
// в camelCase, ink-цвета (#222124/чёрный/#2A75F4) -> currentColor, чтобы
// иконка наследовала цвет кнопки/контейнера. Акцентные статус-цвета
// (успех/ошибка/бренд) — через токены design/tokens.ts, не literal-hex
// (страж no-hex-drift.test.ts запрещает hex вне tokens.ts).
// Часть C реестра figmaIcons, см. index.ts.

const documentDeleteIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M16.5 8L13.5 5.5L10 2.5H3.5V17.5H16.5V8ZM16.5 8H10V3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12.1211 10.3787L7.87845 14.6213"
      stroke={cssVar(palette.support01)}
      strokeWidth="2"
    />
    <path
      d="M12.1211 14.6213L7.87845 10.3787"
      stroke={cssVar(palette.support01)}
      strokeWidth="2"
    />
  </svg>
)

const menuIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M2 4L18 4" stroke="currentColor" strokeWidth="3" />
    <path d="M2 10L18 10" stroke="currentColor" strokeWidth="3" />
    <path d="M2 16L18 16" stroke="currentColor" strokeWidth="3" />
  </svg>
)

const dotsIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="10.0001" cy="4.09336" r="2.10947" fill="currentColor" />
    <circle cx="10.0001" cy="10.0001" r="2.10947" fill="currentColor" />
    <circle cx="10.0001" cy="15.9066" r="2.10947" fill="currentColor" />
  </svg>
)

const searchIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="3" />
    <path d="M14 14L19 19" stroke="currentColor" strokeWidth="3" />
  </svg>
)

const advancedSearchIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="3" />
    <path d="M14 14L19 19" stroke="currentColor" strokeWidth="3" />
    <path d="M5 8.84131L13 8.84131" stroke="currentColor" strokeWidth="3" />
    <path d="M9.00244 13L9.00244 5" stroke="currentColor" strokeWidth="3" />
  </svg>
)

const cancelSearchIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="3" />
    <path d="M14 14L19 19" stroke="currentColor" strokeWidth="3" />
    <path
      d="M2.17236 10L11.0002 18.8278"
      stroke={cssVar(palette.support01)}
      strokeWidth="3"
    />
    <path
      d="M2 19.0054L10.8278 10.1776"
      stroke={cssVar(palette.support01)}
      strokeWidth="3"
    />
  </svg>
)

const starIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M19.1667 5.79667H13.56L11.705 0H8.295L6.44 5.79667H0.833333L0 9.51917L4.25 12.6308L2.13917 19.1808L5.74333 20L10 16.86L14.26 20L17.8633 19.1775L15.75 12.6308L20 9.51917L19.1667 5.79667ZM12.8183 11.6758L14.5683 17.12L10 13.7492L5.4275 17.12L7.18167 11.6758L2.57833 8.30333H8.26333L10 2.87583L11.7367 8.30333H17.4217L12.8183 11.6758Z"
      fill="currentColor"
    />
  </svg>
)

const historyIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g>
      <path
        d="M4.70335 4.8668C5.89097 3.64136 7.46676 2.86563 9.16221 2.67177C10.8577 2.47792 12.5679 2.87793 14.0015 3.80366C15.435 4.7294 16.5033 6.12356 17.0242 7.74862C17.5451 9.37368 17.4864 11.1291 16.8581 12.7157C16.2299 14.3024 15.0709 15.6221 13.5787 16.45C12.0865 17.2779 10.3534 17.5628 8.67464 17.2561C6.99592 16.9495 5.47547 16.0703 4.37234 14.7682C3.26921 13.4662 2.65167 11.822 2.62493 10.1157"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M9.62769 6.41479V10.8798L11.5652 12.8173"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M1.77319 6.2345V1.87793L7.00089 6.98959C5.5939 6.99604 2.69085 7.00508 2.33458 6.98959C1.97832 6.9741 1.81188 6.47974 1.77319 6.2345Z"
        fill="currentColor"
      />
    </g>
  </svg>
)

const arrowRightIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M5.64697 2.19849L14.3531 9.94348L5.64697 17.8016"
      stroke="currentColor"
      strokeWidth="3"
    />
  </svg>
)

const arrowLeftIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M15 2L7 10L15 18" stroke="currentColor" strokeWidth="3" />
  </svg>
)

const arrowDownIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M15.3521 7.65161L10.0001 12.3486L4.64812 7.65161"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const arrowUpIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M4.64795 12.3484L9.99992 7.65137L15.3519 12.3484"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const arrowRightSmallIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 5L17 10L12 15" stroke="currentColor" strokeWidth="2" />
    <path d="M3.5 10H15.5" stroke="currentColor" strokeWidth="2" />
  </svg>
)

const arrowLeftSmallIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M12.3484 15.3521L7.65137 10.0001L12.3484 4.64812"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

export const figmaIconsC: Record<string, ReactNode> = {
  'document-delete': documentDeleteIcon,
  menu: menuIcon,
  dots: dotsIcon,
  search: searchIcon,
  'advanced-search': advancedSearchIcon,
  'cancel-search': cancelSearchIcon,
  star: starIcon,
  history: historyIcon,
  'arrow-right': arrowRightIcon,
  'arrow-left': arrowLeftIcon,
  'arrow-down': arrowDownIcon,
  'arrow-up': arrowUpIcon,
  'arrow-right-small': arrowRightSmallIcon,
  'arrow-left-small': arrowLeftSmallIcon,
}

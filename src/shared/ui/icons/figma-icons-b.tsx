import type { ReactNode } from 'react'

import { cssVar, palette } from '@/shared/design/tokens'

// Иконки секции Icons -> «20» из Figma (fileKey 8RxAFhNubquQ1bz912H2wB),
// сконвертированы в inline-SVG по образцу button-icons.tsx: атрибуты
// в camelCase, ink-цвета (#222124/чёрный/#2A75F4) -> currentColor, чтобы
// иконка наследовала цвет кнопки/контейнера. Акцентные статус-цвета
// (успех/ошибка/бренд) — через токены design/tokens.ts, не literal-hex
// (страж no-hex-drift.test.ts запрещает hex вне tokens.ts).
// Часть B реестра figmaIcons, см. index.ts.

const uncheckAllIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M6.6416 18.6752H12.5129C15.8266 18.6752 18.5129 15.9889 18.5129 12.6752V10"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="3"
      y="3"
      width="12"
      height="12"
      rx="4"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const printIcon: ReactNode = (
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
        d="M18 8C18 7.46957 17.7893 6.96086 17.4142 6.58579C17.0391 6.21071 16.5304 6 16 6H14.6667V2H5.33333V6H4C3.46957 6 2.96086 6.21071 2.58579 6.58579C2.21071 6.96086 2 7.46957 2 8L2 16H5.33333V18H14.6667V16H18V8ZM7.33333 4H12.6667V6H7.33333V4ZM12.6667 16H7.33333V12.6667H12.6667V16ZM16 14H14.6667V10.6667H5.33333V14H4V8H16V14Z"
        fill="currentColor"
      />
    </g>
  </svg>
)

const report2Icon: ReactNode = (
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
        d="M7.66667 14.0001H5.66667V11.3334H7.66667V14.0001ZM11 8.66675H9V14.0001H11V8.66675ZM14.3333 10.0001H12.3333V14.0001H14.3333V10.0001ZM18 5.00008V17.3334H2V5.00008C2 3.71341 3.04667 2.66675 4.33333 2.66675H15.6667C16.9533 2.66675 18 3.71341 18 5.00008ZM7.33333 5.00008C7.33333 5.55208 7.78133 6.00008 8.33333 6.00008C8.88533 6.00008 9.33333 5.55208 9.33333 5.00008C9.33333 4.44808 8.88533 4.00008 8.33333 4.00008C7.78133 4.00008 7.33333 4.44808 7.33333 5.00008ZM4 5.00008C4 5.55208 4.448 6.00008 5 6.00008C5.552 6.00008 6 5.55208 6 5.00008C6 4.44808 5.552 4.00008 5 4.00008C4.448 4.00008 4 4.44808 4 5.00008ZM16 7.33342H4V15.3334H16V7.33342Z"
        fill="currentColor"
      />
    </g>
  </svg>
)

const questionIcon: ReactNode = (
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
        d="M11.0001 14.6667H9.00015V14.1427C9.00015 12.562 9.92548 11.1813 11.6061 10.2547C12.8761 9.55465 13.5335 8.16732 13.2795 6.72065C13.0448 5.38532 11.9481 4.28865 10.6128 4.05399C9.60415 3.87732 8.62681 4.13465 7.85881 4.77865C7.10148 5.41465 6.66748 6.34599 6.66748 7.33332H4.66748C4.66748 5.75332 5.36215 4.26399 6.57281 3.24732C7.78215 2.23132 9.38281 1.80865 10.9581 2.08399C13.1075 2.46132 14.8721 4.22599 15.2495 6.37532C15.6475 8.64132 14.5708 10.9047 12.5715 12.0067C11.5288 12.5813 11.0001 13.2993 11.0001 14.1427V14.6667ZM11.0001 16H9.00015V18H11.0001V16Z"
        fill="currentColor"
      />
    </g>
  </svg>
)

const documentDoneIcon: ReactNode = (
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
      d="M6.5 11.875L8.93478 14.5L14.5 8.5"
      stroke={cssVar(palette.support02)}
      strokeWidth="2"
    />
  </svg>
)

const showInListIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M6.98633 16.4287H13.0737C15.2829 16.4287 17.0737 14.6379 17.0737 12.4287V8.28568V6.354C17.0737 4.81715 15.8279 3.57129 14.291 3.57129H6.98633C4.77719 3.57129 2.98633 5.36215 2.98633 7.57129V12.4287C2.98633 14.6378 4.77719 16.4287 6.98633 16.4287Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M7.54346 3.57129V16.2081" stroke="currentColor" strokeWidth="2" />
    <path
      d="M17.8076 7.85718L2.61999 7.85718"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M17.8076 12.1428L2.61999 12.1428"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M19.0396 7.27979L15.0396 11.2798L11.0396 7.27979"
      stroke={cssVar(palette.support02)}
      strokeWidth="2"
    />
    <path
      d="M15.0396 10.2798V0"
      stroke={cssVar(palette.support02)}
      strokeWidth="2"
    />
  </svg>
)

const editTableIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M6.98633 16.4287H13.0737C15.2829 16.4287 17.0737 14.6379 17.0737 12.4287V8.28568V6.354C17.0737 4.81715 15.8279 3.57129 14.291 3.57129H6.98633C4.77719 3.57129 2.98633 5.36215 2.98633 7.57129V12.4287C2.98633 14.6378 4.77719 16.4287 6.98633 16.4287Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M7.54346 3.57129V16.2081" stroke="currentColor" strokeWidth="2" />
    <path
      d="M17.8076 7.85718L2.61999 7.85718"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M17.8076 12.1428L2.61999 12.1428"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M7.1534 15.7665L13.3822 9.53768L14.9971 7.92279C15.5068 7.41315 16.3331 7.41315 16.8427 7.92279C17.3524 8.43244 17.3524 9.25873 16.8427 9.76838L15.2278 11.3833L8.99898 17.6121L6.9227 17.8428L7.1534 15.7665Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="15.9199"
      y="7"
      width="2.61005"
      height="3.26256"
      transform="rotate(45 15.9199 7)"
      fill="currentColor"
    />
  </svg>
)

const documentGreenArrowIcon: ReactNode = (
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
      d="M19.834 9L15.834 13L11.834 9"
      stroke={cssVar(palette.support02)}
      strokeWidth="2"
    />
    <path
      d="M15.834 12V1.72021"
      stroke={cssVar(palette.support02)}
      strokeWidth="2"
    />
  </svg>
)

const documentRedArrowIcon: ReactNode = (
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
      d="M11.248 16.4956L7.24805 12.4956L11.248 8.49561"
      stroke={cssVar(palette.support01)}
      strokeWidth="2"
    />
    <path
      d="M8.24805 12.4958L17.748 12.4959"
      stroke={cssVar(palette.support01)}
      strokeWidth="2"
    />
  </svg>
)

export const figmaIconsB: Record<string, ReactNode> = {
  'uncheck-all': uncheckAllIcon,
  print: printIcon,
  'report-2': report2Icon,
  question: questionIcon,
  'document-done': documentDoneIcon,
  'show-in-list': showInListIcon,
  'edit-table': editTableIcon,
  'document-green-arrow': documentGreenArrowIcon,
  'document-red-arrow': documentRedArrowIcon,
}

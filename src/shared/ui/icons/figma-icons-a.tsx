import type { ReactNode } from 'react'

import { cssVar, palette } from '@/shared/design/tokens'

// Иконки секции Icons -> «20» из Figma (fileKey 8RxAFhNubquQ1bz912H2wB),
// сконвертированы в inline-SVG по образцу button-icons.tsx: атрибуты
// в camelCase, ink-цвета (#222124/чёрный/#2A75F4) -> currentColor, чтобы
// иконка наследовала цвет кнопки/контейнера. Акцентные статус-цвета
// (успех/ошибка/бренд) — через токены design/tokens.ts, не literal-hex
// (страж no-hex-drift.test.ts запрещает hex вне tokens.ts).
// Часть A реестра figmaIcons, см. index.ts.

const debetKreditIcon: ReactNode = (
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
        d="M1.25586 9.21597V6.97597H1.77586C1.84519 6.81064 1.90653 6.61864 1.95986 6.39997C2.01319 6.17597 2.05586 5.93597 2.08786 5.67997C2.12519 5.41864 2.15186 5.14931 2.16786 4.87197C2.18919 4.58931 2.19986 4.30397 2.19986 4.01597V2.27197H5.99986V6.97597H6.63986V9.21597H5.60786V7.99997H2.28786V9.21597H1.25586ZM2.87986 6.97597H4.92786V3.29597H3.23186V4.19997C3.23186 4.54131 3.21853 4.87731 3.19186 5.20797C3.16519 5.53331 3.12519 5.83997 3.07186 6.12797C3.02386 6.41597 2.95986 6.67731 2.87986 6.91197V6.97597Z"
        fill="currentColor"
      />
      <path
        d="M9.6853 7.99997V2.81597H10.7573V7.99997H9.6853ZM7.9253 3.29597V2.27197H12.5173V3.29597H7.9253Z"
        fill="currentColor"
      />
      <path
        d="M1.25586 9.21597V6.97597H1.77586C1.84519 6.81064 1.90653 6.61864 1.95986 6.39997C2.01319 6.17597 2.05586 5.93597 2.08786 5.67997C2.12519 5.41864 2.15186 5.14931 2.16786 4.87197C2.18919 4.58931 2.19986 4.30397 2.19986 4.01597V2.27197H5.99986V6.97597H6.63986V9.21597H5.60786V7.99997H2.28786V9.21597H1.25586ZM2.87986 6.97597H4.92786V3.29597H3.23186V4.19997C3.23186 4.54131 3.21853 4.87731 3.19186 5.20797C3.16519 5.53331 3.12519 5.83997 3.07186 6.12797C3.02386 6.41597 2.95986 6.67731 2.87986 6.91197V6.97597Z"
        stroke="currentColor"
      />
      <path
        d="M9.6853 7.99997V2.81597H10.7573V7.99997H9.6853ZM7.9253 3.29597V2.27197H12.5173V3.29597H7.9253Z"
        stroke="currentColor"
      />
    </g>
    <g>
      <path
        d="M7.85352 18V12.272H8.93352V14.96H8.99752L10.9655 12.272H12.2535V12.336L10.1575 15.16L12.3975 17.936V18H11.0535L8.99752 15.448H8.93352V18H7.85352Z"
        fill="currentColor"
      />
      <path
        d="M15.382 18V12.816H16.454V18H15.382ZM13.622 13.296V12.272H18.214V13.296H13.622Z"
        fill="currentColor"
      />
      <path
        d="M7.85352 18V12.272H8.93352V14.96H8.99752L10.9655 12.272H12.2535V12.336L10.1575 15.16L12.3975 17.936V18H11.0535L8.99752 15.448H8.93352V18H7.85352Z"
        stroke="currentColor"
      />
      <path
        d="M15.382 18V12.816H16.454V18H15.382ZM13.622 13.296V12.272H18.214V13.296H13.622Z"
        stroke="currentColor"
      />
    </g>
  </svg>
)

const copyIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      x="3.12354"
      y="8.40869"
      width="8.41162"
      height="8.41162"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M7.41089 5.95779V3.37622H16.945V12.604H14.0411"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const layersIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="2" y="3" width="11" height="3" fill="currentColor" />
    <rect x="5" y="8" width="11" height="3" fill="currentColor" />
    <rect x="7" y="13" width="11" height="3" fill="currentColor" />
    <path d="M18 10.5V5H14.5" stroke="currentColor" />
    <path d="M2 9L2 14.5L5.5 14.5" stroke="currentColor" />
  </svg>
)

const addDocumentIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M16 7.5L13 5L9.5 2H3V17H16V7.5ZM16 7.5H9.5V2.5"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="16" cy="16" r="4" fill={cssVar(palette.support02)} />
    <path d="M16 14V18" stroke="currentColor" strokeWidth="2" />
    <path d="M18 16L14 16" stroke="currentColor" strokeWidth="2" />
  </svg>
)

const addFolderIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M2 3H10L12 7.5H18V14C18 15.1046 17.1046 16 16 16H4C2.89543 16 2 15.1046 2 14V3Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M18 6.5L18 4L10 4" stroke="currentColor" strokeWidth="2" />
    <circle cx="16" cy="16" r="4" fill={cssVar(palette.support02)} />
    <path d="M16 14V18" stroke="currentColor" strokeWidth="2" />
    <path d="M18 16L14 16" stroke="currentColor" strokeWidth="2" />
  </svg>
)

const searchDocumentIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M16 9.5V7.5L13 5L9.5 2H3V17H9.5M16 7.5H9.5V2.5"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M16 16L18 18" stroke="currentColor" strokeWidth="2" />
  </svg>
)

const saveIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <g>
      <g>
        <path
          d="M17.1213 4.8887L15.1113 2.87936C14.5502 2.31445 13.7862 1.99776 12.99 2.00001H5C3.34391 2.00186 2.00184 3.34392 2 5.00001V15C2.00184 16.6561 3.34391 17.9982 5 18H15C16.6561 17.9982 17.9982 16.6561 18 15V7.01001C18.0023 6.21392 17.6859 5.45001 17.1213 4.8887ZM16 15C16 15.5523 15.5523 16 15 16H5C4.44772 16 4 15.5523 4 15V5.00001C4 4.44773 4.44772 4.00001 5 4.00001H6C6 5.47276 7.19391 6.66667 8.66666 6.66667H10.6667C12.1132 6.66379 13.2937 5.50817 13.3273 4.06201C13.4661 4.11045 13.5922 4.18923 13.6967 4.29267L15.7073 6.30332C15.8953 6.49039 16.0007 6.74482 16 7.00998V15H16Z"
          fill="currentColor"
        />
        <path
          d="M9.99991 14.0001C11.4727 14.0001 12.6666 12.8062 12.6666 11.3334C12.6666 9.86065 11.4727 8.66675 9.99991 8.66675C8.52715 8.66675 7.33325 9.86065 7.33325 11.3334C7.33325 12.8062 8.52715 14.0001 9.99991 14.0001Z"
          fill="currentColor"
        />
      </g>
    </g>
  </svg>
)

const refreshIcon: ReactNode = (
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
        d="M10 3.99319C11.5913 3.99855 13.1157 4.63373 14.24 5.75986L12.6573 7.34253H16.544C16.7466 7.34253 16.941 7.26203 17.0842 7.11876C17.2275 6.97548 17.308 6.78115 17.308 6.57853V2.69186L15.6473 4.35253C14.5311 3.23102 13.1069 2.46637 11.5554 2.15557C10.0038 1.84478 8.39497 2.00186 6.93288 2.60689C5.47078 3.21191 4.22135 4.23761 3.34311 5.55384C2.46487 6.87008 1.9974 8.41753 2.00001 9.99986H3.99334C3.99511 8.40734 4.62852 6.88054 5.75461 5.75445C6.88069 4.62837 8.40749 3.99496 10 3.99319Z"
        fill="currentColor"
      />
      <path
        d="M16.0066 10C16.0088 11.1881 15.6579 12.3502 14.9985 13.3386C14.3392 14.327 13.401 15.0972 12.3032 15.5515C11.2053 16.0058 9.99719 16.1237 8.83221 15.8902C7.66723 15.6567 6.59789 15.0823 5.75989 14.24L7.34256 12.6573H3.32856C3.15976 12.6575 2.99792 12.7246 2.87856 12.844C2.7592 12.9634 2.69207 13.1252 2.69189 13.294V17.308L4.35256 15.6473C5.46881 16.7688 6.89304 17.5335 8.44455 17.8443C9.99607 18.1551 11.6049 17.998 13.067 17.393C14.5291 16.788 15.7786 15.7623 16.6568 14.446C17.535 13.1298 18.0025 11.5823 17.9999 10H16.0066Z"
        fill="currentColor"
      />
    </g>
  </svg>
)

const copyDocumentIcon: ReactNode = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M14.9142 6.55762L12.1747 4.27468L8.97861 1.53516H3.04297V15.2328H14.9142V6.55762ZM14.9142 6.55762H8.97861V1.99174"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M6.6416 18.6752H18.5129V10"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
)

const checkAllIcon: ReactNode = (
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
      fill={cssVar(palette.accent01)}
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M6 9.25L7.82609 11L12 7" stroke="currentColor" strokeWidth="2" />
  </svg>
)

export const figmaIconsA: Record<string, ReactNode> = {
  'debet-kredit': debetKreditIcon,
  copy: copyIcon,
  layers: layersIcon,
  'add-document': addDocumentIcon,
  'add-folder': addFolderIcon,
  'search-document': searchDocumentIcon,
  save: saveIcon,
  refresh: refreshIcon,
  'copy-document': copyDocumentIcon,
  'check-all': checkAllIcon,
}

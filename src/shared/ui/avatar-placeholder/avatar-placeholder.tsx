import type { FC } from 'react'

// SCRUM-308 v3 §2.3: серый силуэт вместо отсутствующего фото — рисует фронт,
// сервер заглушку не отдаёт (GET без фото отвечает 404). Цвет наследуется
// через currentColor от контейнера (text-ui-05 и т.п.), масштаб — от размера
// контейнера: SVG растягивается на 100%.
export const AvatarPlaceholder: FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="8.5" r="4" fill="currentColor" />
    <path d="M4 20.5c0-3.6 3.6-6 8-6s8 2.4 8 6v.5H4v-.5Z" fill="currentColor" />
  </svg>
)

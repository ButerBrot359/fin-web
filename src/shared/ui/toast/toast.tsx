import { Toaster as SonnerToaster } from 'sonner'

// SCRUM-317 v4 §4.3: панель ошибок и тосты делят правый нижний угол — стек
// тостов поднимается на высоту панели. Панель публикует свою высоту в
// CSS-переменную (validation-panel.tsx); контракт между слоями — имя
// переменной и фолбэк 0px (панели нет → переменной нет → отступ обычный).
// Про саму панель shared не знает.
export const Toaster = () => (
  <SonnerToaster
    position="bottom-right"
    offset={{
      bottom: 'calc(var(--sdui-validation-panel-height, 0px) + 24px)',
    }}
  />
)

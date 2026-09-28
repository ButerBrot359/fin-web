import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

import {
  CORNER_RIGHT_PX,
  CORNER_STACK_TOP_VAR,
  CORNER_STACK_WIDTH_VAR,
  TOAST_BOTTOM_PX,
  TOAST_WIDTH_PX,
} from '@/shared/lib/utils/corner-stack'

// SCRUM-317 v6 §4.3: тосты — верхний этаж колонки правого нижнего угла.
// Нижний этаж (панель ошибок) публикует занятое место в CSS-переменные;
// фолбэки возвращают обычные отступ и ширину, когда нижнего этажа нет —
// на экранах без панели (включая легаси) ничего не сдвигается.
//
// --width sonner отдаёт только своим стилизованным тостам, а у наших разметка
// своя (toast.custom) — поэтому содержимое читает переменную само
// (show-toast.tsx), здесь она только объявляется на контейнере.
const toasterStyle = {
  '--width': `var(${CORNER_STACK_WIDTH_VAR}, ${String(TOAST_WIDTH_PX)}px)`,
} as CSSProperties

export const Toaster = () => (
  <SonnerToaster
    position="bottom-right"
    style={toasterStyle}
    offset={{
      bottom: `var(${CORNER_STACK_TOP_VAR}, ${String(TOAST_BOTTOM_PX)}px)`,
      right: `${String(CORNER_RIGHT_PX)}px`,
    }}
  />
)

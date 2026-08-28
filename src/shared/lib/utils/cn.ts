import clsx from 'clsx'
import type { ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge не знает наших размеров текста (`text-h2`, `text-body2`…) из tailwind.config
 * и по имени принимает их за цвета. Из-за этого в паре «размер + цвет» одно вычёркивало другое:
 * `cn('text-body2', 'text-ui-06')` отдавал только `text-body2`, и кнопка теряла цвет текста.
 * Перечисляем размеры явно — тогда размер конфликтует только с размером, а цвет с цветом.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['h2', 'h3', 'body1', 'body2'] }],
    },
  },
})

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

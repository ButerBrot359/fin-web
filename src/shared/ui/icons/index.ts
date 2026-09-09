import type { ReactNode } from 'react'

import { figmaIconsA } from './figma-icons-a'
import { figmaIconsB } from './figma-icons-b'
import { figmaIconsC } from './figma-icons-c'
import { figmaIconsD } from './figma-icons-d'
import { figmaIconsE } from './figma-icons-e'

/**
 * Реестр иконок, выгруженных из Figma (секция Icons -> «20»,
 * fileKey 8RxAFhNubquQ1bz912H2wB). Ключи — kebab-case имена узлов
 * Figma. Иконки наследуют цвет через currentColor (см. figma-icons-*.tsx).
 */
export const figmaIcons: Record<string, ReactNode> = {
  ...figmaIconsA,
  ...figmaIconsB,
  ...figmaIconsC,
  ...figmaIconsD,
  ...figmaIconsE,
}

export type FigmaIconName = keyof typeof figmaIcons

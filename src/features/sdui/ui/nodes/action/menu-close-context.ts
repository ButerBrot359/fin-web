import { createContext, useContext } from 'react'

/**
 * Закрытие ближайшего SDUI dropdown-меню из пути активации пункта
 * (SCRUM-276 spec v1 §6: меню должно закрыться ДО серверного confirm, иначе
 * его backdrop перекроет диалог). Контекст вместо capture-обёртки: клики по
 * disabled-пунктам/разделителям меню не закрывают, вложенные дропдауны и
 * клавиатурная навигация MenuList не ломаются. Провайдеры вложенных меню
 * составляют цепочку: активация конечного пункта закрывает все уровни.
 */
export const MenuCloseContext = createContext<(() => void) | null>(null)

export const useMenuClose = (): (() => void) | null =>
  useContext(MenuCloseContext)

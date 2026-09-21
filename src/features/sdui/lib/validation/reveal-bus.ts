// SCRUM-317: содержимое неактивной вкладки TABS не смонтировано в DOM —
// «переключение вкладки делайте ДО поиска элемента» (v2 §7). Шина связывает
// тултип-навигатор с каждым смонтированным TabsNode: вкладка находится по
// УЗЛУ дерева (поиск binding в поддереве), а не по DOM.
//
// v4 §4.5: вместе с binding передаётся ВИД цели — без него вкладка ищется по
// одному коду и поле шапки находит первую вкладку с одноимённой колонкой ТЧ
// («Отпуск» перебрасывало на «Сотрудников» при ошибке поля шапки).

import type { RevealKind } from './subtree-has-binding'

type RevealHandler = (binding: string, kind: RevealKind) => void

const handlers = new Set<RevealHandler>()

export function registerRevealHandler(handler: RevealHandler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/**
 * Просит все ленты вкладок раскрыть вкладку, содержащую узел с binding
 * данного вида. kind обязателен по существу: null — только для сообщений без
 * структурного адреса (легаси-канал), поведение прежнее.
 */
export function revealBinding(binding: string, kind: RevealKind): void {
  for (const handler of handlers) handler(binding, kind)
}

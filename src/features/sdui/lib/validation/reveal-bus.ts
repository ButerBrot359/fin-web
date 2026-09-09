// SCRUM-317: содержимое неактивной вкладки TABS не смонтировано в DOM —
// «переключение вкладки делайте ДО поиска элемента» (v2 §7). Шина связывает
// тултип-навигатор с каждым смонтированным TabsNode: вкладка находится по
// УЗЛУ дерева (поиск binding в поддереве), а не по DOM.

type RevealHandler = (binding: string) => void

const handlers = new Set<RevealHandler>()

export function registerRevealHandler(handler: RevealHandler): () => void {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/** Просит все ленты вкладок раскрыть вкладку, содержащую узел с binding. */
export function revealBinding(binding: string): void {
  for (const handler of handlers) handler(binding)
}

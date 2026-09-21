/**
 * SCRUM-360 v6 §6.3: «Создать» и «Создать группу» справочника делят один
 * pathname (`/dictionaries/{T}/new`) и различаются только query-параметром
 * `isGroup=true`. Ключ вкладки и ключ SDUI-сессии обязаны различать эти два
 * экрана — иначе переход «создание элемента → создание группы» не переоткрывает
 * форму и пользователь видит старую.
 *
 * Прочие query-параметры (`parentId`, `ls`, `rp`, `copyFrom`…) в ключ не входят
 * намеренно: их смена не меняет идентичность экрана (а `ls` сервер меняет
 * REPLACE_URL-эффектом на каждое раскрытие узла дерева).
 */
export const isGroupCreate = (search: string): boolean =>
  new URLSearchParams(search).get('isGroup') === 'true'

/** Маршрутный ключ экрана: pathname + маркер создания группы. */
export const groupCreateRoute = (pathname: string, search: string): string =>
  isGroupCreate(search) ? `${pathname}?isGroup=true` : pathname

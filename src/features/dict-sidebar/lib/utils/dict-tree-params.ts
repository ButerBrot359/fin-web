/**
 * Санитайзинг параметров панели выбора справочника для древовидного режима.
 *
 * Панель открывается двумя путями, и оба кладут серверные параметры в один и тот же
 * `panel.searchParams`: поле шапки — из `props.source.params` команды `ref.showAll`,
 * ячейка ТЧ — из `props.filter` ячейки. Поэтому чистить параметры нужно здесь, в одном
 * месте, а не в каждом вызывающем компоненте.
 */

/**
 * Параметры уровня иерархии, которыми владеет само дерево, а не поле.
 *
 * - `parent` — дерево подставляет само (id раскрываемого узла);
 * - `flatWithGroups` — сервер шлёт его, пока панель плоская; в дереве он схлопнул бы
 *   уровень во весь справочник (замер стенда: 110 строк вместо 15 корневых);
 * - `grouped=false` — вернул бы одни листья, без папок.
 */
const TREE_OWNED_PARAMS = ['parent', 'flatWithGroups', 'grouped']

const omit = (
  params: Record<string, string> | undefined,
  keys: string[]
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params ?? {}).filter(([key]) => !keys.includes(key))
  )

/**
 * Параметры запроса одного уровня дерева: серверные отборы поля (`af`, `entryIds`…)
 * сохраняются, параметры иерархии задаёт дерево. Корень — без `parent`
 * (бэк отдаёт `parent IS NULL`: папки + записи корня).
 */
export const buildTreeLevelParams = (
  searchParams: Record<string, string> | undefined,
  parentId?: number
): Record<string, unknown> => {
  const scoped = omit(searchParams, TREE_OWNED_PARAMS)
  return parentId != null ? { ...scoped, parent: parentId } : scoped
}

/**
 * Параметры поиска. `parent` вместе с поисковой строкой бэк отвергает (HTTP 400 —
 * поиск внутри папки не поддержан), поэтому непустой поиск уплощает дерево и ищет
 * по всему справочнику, как в 1С. Остальные отборы поля сохраняются.
 */
export const buildSearchParams = (
  searchParams: Record<string, string> | undefined
): Record<string, string> => omit(searchParams, ['parent'])

/**
 * Поле выбирает ПАПКУ, а не элемент (`referenceSelectionMode=GROUP`). Бэк на такой
 * панели отдаёт плоский список всех групп и игнорирует `parent`/`grouped`, поэтому
 * дерево тут не нужно: папки выбираются как обычные строки, проваливаться некуда.
 */
export const isGroupsOnlyPanel = (
  searchParams: Record<string, string> | undefined
): boolean => searchParams?.groupsOnly === 'true'

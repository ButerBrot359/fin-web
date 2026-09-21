import { useEffect, useRef, useState } from 'react'

import type { ViewNode } from '../../types/view'
import type {
  ListRow,
  ListSource,
} from '../../ui/nodes/composite/list-column-defs'
import type { ListTrailEntry } from '../../ui/nodes/composite/list-breadcrumbs'
import {
  buildLevelParams,
  isGroupRow,
  parseSelectedPath,
  resolveRowLabel,
  supportsHierarchy,
} from '../../ui/nodes/composite/list-hierarchy'
import { isTreeDisplayMode } from '../utils/list-tree-mode'

interface UseListTrailArgs {
  node: ViewNode
  source: ListSource | undefined
  /** ОТЛОЖЕННАЯ строка поиска — см. комментарий к isSearchMode. */
  debouncedSearch: string
}

/**
 * Навигация по папкам иерархического справочника + выделенная строка LIST-узла.
 * Выделение живёт здесь же: провал в папку и смена source его сбрасывают.
 */
export const useListTrail = ({
  node,
  source,
  debouncedSearch,
}: UseListTrailArgs) => {
  // Панель выбора открывается на записи, стоящей в поле: сервер кладёт её id в
  // props.selectedId (клиенту неоткуда его взять — панель приходит отдельным
  // поддеревом и связи с полем не имеет).
  const serverSelectedId = node.props?.selectedId as number | undefined
  const [selectedRowId, setSelectedRowId] = useState<number | null>(
    serverSelectedId ?? null
  )

  // Путь по папкам справочника; пустой — корневой уровень. Начальное значение —
  // с сервера: если запись из поля лежит внутри папки, панель открывается сразу там,
  // иначе выделять на корне нечего (её строки там просто нет).
  const [trail, setTrail] = useState<ListTrailEntry[]>(() =>
    parseSelectedPath(node.props?.selectedPath)
  )
  // SCRUM-360 v6 §8: в древовидном режиме клиентский drill-down выключен —
  // раскрытием владеет сервер (list.toggleExpand), крошки не рендерятся.
  // Drill-down не удалён: он остаётся режимом пикера и не-древовидных типов.
  const isHierarchical = !isTreeDisplayMode(node) && supportsHierarchy(source)
  // Режим поиска считается по ОТЛОЖЕННОЙ строке — вместе с ней меняется и уровень папки
  // (parent уходит из запроса), иначе на первом же символе улетал бы лишний запрос по всему
  // дереву, ещё без самого поиска.
  const isSearchMode = debouncedSearch.trim().length > 0
  // Непустой поиск уплощает уровни и ищет по всему справочнику (эталон 1С): `parent`
  // вместе с поисковой строкой бэк отвергает (HTTP 400 — поиск внутри папки не
  // поддержан). Путь при этом сохраняется: очистили поиск — вернулись на свой уровень.
  const parentId = isSearchMode ? undefined : trail.at(-1)?.id
  const levelParams = isHierarchical
    ? buildLevelParams(source?.params, parentId)
    : source?.params

  // SCRUM-291 M5: сервер может заменить props.source ответом на sort/filter/period
  // (setProp-патч на LIST-узле) — при смене идентичности source выделенная строка
  // могла уйти из выборки, поэтому сбрасываем выделение. Пропускаем первый рендер,
  // чтобы не сбрасывать выделение, которого ещё не было.
  const sourceKey = JSON.stringify(source ?? null)
  const isFirstSourceRender = useRef(true)
  useEffect(() => {
    if (isFirstSourceRender.current) {
      isFirstSourceRender.current = false
      return
    }
    // Сброс в эффекте намеренный (поведение перенесено 1:1 из list-node при
    // декомпозиции): смена source — внешнее событие (setProp-патч сервера),
    // сброс выделения после коммита — исходная семантика SCRUM-291 M5.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRowId(null)
  }, [sourceKey])

  // Провал в папку: строка-группа — навигация внутрь, а не выбор значения.
  const drillInto = (row: ListRow) => {
    setSelectedRowId(null)
    setTrail((prev) => [...prev, { id: row.id, label: resolveRowLabel(row) }])
  }

  const canDrillInto = (row: ListRow) =>
    isHierarchical && !isSearchMode && isGroupRow(row)

  /** Хлебные крошки: `depth` — сколько сегментов пути оставить. */
  const navigateToDepth = (depth: number) => {
    setSelectedRowId(null)
    setTrail((prev) => prev.slice(0, depth))
  }

  return {
    selectedRowId,
    setSelectedRowId,
    trail,
    isHierarchical,
    isSearchMode,
    levelParams,
    drillInto,
    canDrillInto,
    navigateToDepth,
  }
}

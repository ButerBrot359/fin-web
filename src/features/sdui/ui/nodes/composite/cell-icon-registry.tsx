import type { FC, SVGProps } from 'react'

import DocDeletedIcon from '@/shared/assets/icons/doc-deleted.svg'
import DocDraftIcon from '@/shared/assets/icons/doc-draft.svg'
import DocPostedIcon from '@/shared/assets/icons/doc-posted.svg'
import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ListElementIcon from '@/shared/assets/icons/list-element-icon.svg'

type CellIconComponent = FC<SVGProps<SVGSVGElement>>

// SCRUM-291 3b (§17.2): реестр имён иконок для TABLE_COLUMN.props.cellKind==="ICON".
// Сегодня обслуживает глиф группы/элемента иерархического справочника (iconMap
// {"true":"folder","false":"listElement"}), спроектирован на переиспользование
// под будущую иконку статуса документа (ADR-0035 2e) — просто добавить запись.
// Record<string, ...| undefined> (не просто CellIconComponent) — честно
// отражает, что доступ по произвольному строковому ключу может промахнуться
// (tsconfig без noUncheckedIndexedAccess иначе считает индексацию всегда truthy).
const CELL_ICONS: Record<string, CellIconComponent | undefined> = {
  folder: FolderIcon,
  listElement: ListElementIcon,
  // SCRUM-45 §4-бис.2: иконки состояния документа для колонки статуса
  // («КартинкаЗначения»/«ИндексКартинкиСостояния» из 1С). Бэк эмитит iconMap
  // со значениями-именами из этого реестра: docPosted — проведён, docDraft —
  // записан не проведён, docDeleted — помечен на удаление. Те же глифы, что
  // в легаси-списке документов и в SDUI-дереве подчинённости.
  docPosted: DocPostedIcon,
  docDraft: DocDraftIcon,
  docDeleted: DocDeletedIcon,
}

// Неизвестное/отсутствующее имя → null (пустая ячейка), НЕ исключение (§17.2):
// сервер может прислать имя, для которого фронт ещё не завёл иконку.
export const getCellIcon = (name?: string): CellIconComponent | null => {
  if (!name) return null
  return CELL_ICONS[name] ?? null
}

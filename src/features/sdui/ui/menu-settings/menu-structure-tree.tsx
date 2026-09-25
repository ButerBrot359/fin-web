import { useState, type DragEvent, type FC, type ReactNode } from 'react'

import type {
  MenuStructure,
  MenuStructureModule,
} from '../../api/menu-settings-api'
import type { MenuSettingsEditorState } from '../../lib/menu-settings/use-menu-settings-editor'
import { MenuTreeRow } from './menu-tree-row'

interface MenuStructureTreeProps {
  structure: MenuStructure
  editor: MenuSettingsEditorState
}

interface DragState {
  parentKey: string
  key: string
}

/** Пункт «Настройка меню» нескрываем ни на одном уровне (спека §3.5). */
const isProtected = (key: string): boolean => key.endsWith('/NastroykaMenyu')

/**
 * Дерево редактора меню (SCRUM-426): модули → секции → ссылки в порядке
 * черновика. Клик по строке модуля раскрывает содержимое, перестановка —
 * drag-n-drop в пределах родителя (решение владельца 24.09).
 */
export const MenuStructureTree: FC<MenuStructureTreeProps> = ({
  structure,
  editor,
}) => {
  const [expanded, setExpanded] = useState<string | null>(null)
  // Секции — тоже аккордеон: «Администрирование» несёт 700+ ссылок, рендер
  // всех разом замораживает вкладку (найдено на живом стенде 25.09).
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const draft = editor.draft
  if (draft == null) return null

  const localized = (nameRu: string, nameKz: string | null): string =>
    nameKz != null && nameKz !== '' && editor.language === 'kz'
      ? nameKz
      : nameRu

  // «Скрыт другим уровнем»: эффективная скрытость МИНУС вклад сохранённого патча
  // этого слоя (приближение — при совпадении слоёв нижний вклад неразличим).
  const hiddenBelow = (key: string, effectiveHidden: boolean): boolean =>
    effectiveHidden &&
    !(key in structure.patch && structure.patch[key].hidden === true)

  // Сортировка САМИХ узлов по позиции их ключа в черновике (стабильная):
  // сид может содержать дубли кодов (два ЭСФ в «Складе») — обход по ключам
  // размножал бы строки, дубли должны рендериться по одному разу каждый.
  const orderItems = <T extends { key: string }>(
    parentKey: string,
    items: T[]
  ): T[] => {
    const order = draft.orderByParent.get(parentKey)
    if (!order) return items
    const pos = new Map(order.map((k, i) => [k, i] as const))
    return [...items].sort(
      (a, b) =>
        (pos.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
        (pos.get(b.key) ?? Number.MAX_SAFE_INTEGER)
    )
  }

  const dragHandlers = (parentKey: string, key: string) => ({
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      // Данные в dataTransfer недоступны на dragover — источник живёт в стейте.
      e.dataTransfer.setData('text/plain', key)
      setDrag({ parentKey, key })
    },
    onDragOver: (e: DragEvent) => {
      if (drag?.parentKey === parentKey && drag.key !== key) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropKey(key)
      }
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      if (drag?.parentKey === parentKey) {
        editor.moveTo(parentKey, drag.key, key)
      }
      setDrag(null)
      setDropKey(null)
    },
    onDragEnd: () => {
      setDrag(null)
      setDropKey(null)
    },
    dropTarget: dropKey === key && drag?.parentKey === parentKey,
  })

  const row = (
    reactKey: string,
    key: string,
    parentKey: string,
    label: string,
    effectiveHidden: boolean,
    extras?: {
      expandable?: boolean
      expanded?: boolean
      onExpand?: () => void
      children?: ReactNode
    }
  ): ReactNode => (
    <div key={reactKey}>
      <MenuTreeRow
        label={label}
        hiddenInLayer={draft.hidden.has(key)}
        hiddenBelow={hiddenBelow(key, effectiveHidden)}
        busy={editor.busy}
        onToggle={() => {
          editor.toggle(key, hiddenBelow(key, effectiveHidden))
        }}
        protectedItem={isProtected(key)}
        expandable={extras?.expandable}
        expanded={extras?.expanded}
        onExpand={extras?.onExpand}
        {...dragHandlers(parentKey, key)}
      />
      {extras?.children}
    </div>
  )

  const moduleChildren = (module: MenuStructureModule): ReactNode => {
    if (expanded !== module.key) return null
    return (
      <div className="ml-10 flex flex-col gap-1 border-0 border-l border-solid border-divider py-1 pl-4">
        {orderItems(module.key, module.sections).map((section, sectionIdx) =>
          row(
            `${section.key}#${String(sectionIdx)}`,
            section.key,
            module.key,
            localized(section.nameRu, section.nameKz),
            section.effectiveHidden,
            {
              expandable: section.elements.length > 0,
              expanded: expandedSection === section.key,
              onExpand: () => {
                setExpandedSection(
                  expandedSection === section.key ? null : section.key
                )
              },
              children:
                expandedSection === section.key ? (
                  <div className="ml-10 flex flex-col gap-1 py-1">
                    {orderItems(section.key, section.elements).map(
                      (element, elementIdx) =>
                        row(
                          `${element.key}#${String(elementIdx)}`,
                          element.key,
                          section.key,
                          localized(element.nameRu, element.nameKz),
                          element.effectiveHidden
                        )
                    )}
                  </div>
                ) : null,
            }
          )
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {orderItems('', structure.modules).map((module, moduleIdx) =>
        row(
          `${module.key}#${String(moduleIdx)}`,
          module.key,
          '',
          localized(module.nameRu, module.nameKz),
          module.effectiveHidden,
          {
            expandable: true,
            expanded: expanded === module.key,
            onExpand: () => {
              setExpanded(expanded === module.key ? null : module.key)
            },
            children: moduleChildren(module),
          }
        )
      )}
    </div>
  )
}

import { useState, type FC } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

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

/** Пункт «Настройка меню» нескрываем ни на одном уровне (спека §3.5). */
const isProtected = (key: string): boolean => key.endsWith('/NastroykaMenyu')

/**
 * Дерево редактора меню (SCRUM-426 §4.2): модули → секции → ссылки в порядке
 * черновика; модуль раскрывается кликом по названию. Скрытые пункты приглушены,
 * скрытые нижними слоями помечены бейджем.
 */
export const MenuStructureTree: FC<MenuStructureTreeProps> = ({
  structure,
  editor,
}) => {
  const { i18n } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>(null)
  const draft = editor.draft
  if (draft == null) return null

  const localized = (nameRu: string, nameKz: string | null): string =>
    i18n.language === 'kz' && nameKz != null && nameKz !== '' ? nameKz : nameRu

  // «Скрыт уровнем ниже»: эффективная скрытость МИНУС вклад сохранённого патча
  // этого слоя (приближение — при совпадении слоёв нижний вклад неразличим).
  const hiddenBelow = (key: string, effectiveHidden: boolean): boolean =>
    effectiveHidden &&
    !(key in structure.patch && structure.patch[key].hidden === true)

  const orderOf = (parentKey: string, keys: string[]): string[] =>
    editor.draft?.orderByParent.get(parentKey) ?? keys

  const row = (
    key: string,
    parentKey: string,
    label: string,
    effectiveHidden: boolean,
    siblings: string[],
    children?: React.ReactNode,
    onClickLabel?: () => void
  ): React.ReactNode => {
    const index = siblings.indexOf(key)
    return (
      <div key={key}>
        <MenuTreeRow
          label={label}
          hiddenInLayer={draft.hidden.has(key)}
          hiddenBelow={hiddenBelow(key, effectiveHidden)}
          busy={editor.busy}
          canMoveUp={index > 0}
          canMoveDown={index >= 0 && index < siblings.length - 1}
          onToggle={() => {
            editor.toggle(key, hiddenBelow(key, effectiveHidden))
          }}
          onMove={(dir) => {
            editor.move(parentKey, key, dir)
          }}
          protectedItem={isProtected(key)}
        >
          {onClickLabel != null && (
            <button
              type="button"
              onClick={onClickLabel}
              className="shrink-0 border-0 bg-transparent p-0"
            >
              <Typography variant="caption" className="text-interactive-01">
                {expanded === key ? '▴' : '▾'}
              </Typography>
            </button>
          )}
        </MenuTreeRow>
        {children}
      </div>
    )
  }

  const moduleChildren = (module: MenuStructureModule): React.ReactNode => {
    if (expanded !== module.key) return null
    const sectionKeys = module.sections.map((s) => s.key)
    const orderedSections = orderOf(module.key, sectionKeys)
    return (
      <div className="ml-8 flex flex-col gap-1 border-0 border-l border-solid border-divider pl-4">
        {orderedSections.map((sectionKey) => {
          const section = module.sections.find((s) => s.key === sectionKey)
          if (section == null) return null
          const elementKeys = section.elements.map((e) => e.key)
          const orderedElements = orderOf(section.key, elementKeys)
          return row(
            section.key,
            module.key,
            localized(section.nameRu, section.nameKz),
            section.effectiveHidden,
            orderedSections,
            <div className="ml-8 flex flex-col gap-1">
              {orderedElements.map((elementKey) => {
                const element = section.elements.find(
                  (e) => e.key === elementKey
                )
                if (element == null) return null
                return row(
                  element.key,
                  section.key,
                  localized(element.nameRu, element.nameKz),
                  element.effectiveHidden,
                  orderedElements
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const moduleKeys = structure.modules.map((m) => m.key)
  const orderedModules = orderOf('', moduleKeys)

  return (
    <div className="flex flex-col gap-2">
      {orderedModules.map((moduleKey) => {
        const module = structure.modules.find((m) => m.key === moduleKey)
        if (module == null) return null
        return row(
          module.key,
          '',
          localized(module.nameRu, module.nameKz),
          module.effectiveHidden,
          orderedModules,
          moduleChildren(module),
          () => {
            setExpanded(expanded === module.key ? null : module.key)
          }
        )
      })}
    </div>
  )
}

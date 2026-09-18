import type { FC } from 'react'

import type { PageSection } from '../lib/customize-form/page-sections'
import {
  moveAcrossZones,
  moveSection,
  replaceZone,
  toggleSection,
  toggleTab,
  toggleTabColumn,
} from '../lib/customize-form/section-mutations'
import { CustomizeFormSectionCard } from './customize-form-section-card'

interface CustomizeFormSectionListProps {
  sections: PageSection[]
  busy: boolean
  selectedId: string | null
  onSelect: (nodeId: string) => void
  /** Функциональное обновление секций (setState диалога) — правки атомарны. */
  onUpdate: (updater: (current: PageSection[]) => PageSection[]) => void
}

/**
 * Стопка карточек секций страницы (редактор v5): вяжет карточки к чистым
 * мутациям секций — перестановка, скрытие блока/вкладки/колонки, правки зон
 * и перенос элементов между зонами (словарь v3).
 */
export const CustomizeFormSectionList: FC<CustomizeFormSectionListProps> = ({
  sections,
  busy,
  selectedId,
  onSelect,
  onUpdate,
}) => (
  <>
    {sections.map((section, index) => (
      <CustomizeFormSectionCard
        key={section.nodeId}
        section={section}
        canMoveUp={index > 0}
        canMoveDown={index < sections.length - 1}
        busy={busy}
        selectedId={selectedId}
        onMove={(direction) => {
          onUpdate((current) => moveSection(current, index, direction))
        }}
        onToggleSection={() => {
          onUpdate((current) => toggleSection(current, index))
        }}
        onToggleTab={(tabId) => {
          onUpdate((current) => toggleTab(current, index, tabId))
        }}
        onToggleColumn={(tabId, columnId) => {
          onUpdate((current) =>
            toggleTabColumn(current, index, tabId, columnId)
          )
        }}
        onZoneChange={(zoneId, zone) => {
          onUpdate((current) => replaceZone(current, zoneId, zone))
        }}
        onSelect={onSelect}
        onExternalDrop={(nodeId, target) => {
          onUpdate((current) => moveAcrossZones(current, nodeId, target))
        }}
      />
    ))}
  </>
)

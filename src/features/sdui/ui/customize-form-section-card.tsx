import type { FC } from 'react'
import { Checkbox, IconButton, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils/cn'

import type { GridZone } from '../lib/customize-form/grid-zones'
import type { PageSection, TabInfo } from '../lib/customize-form/page-sections'
import { CustomizeFormGridEditor } from './customize-form-grid-editor'

interface CustomizeFormSectionCardProps {
  section: PageSection
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  selectedId: string | null
  onMove: (direction: -1 | 1) => void
  onToggleSection: () => void
  onToggleTab: (tabId: string) => void
  onToggleColumn: (tabId: string, columnId: string) => void
  onZoneChange: (zoneId: string, zone: GridZone) => void
  onSelect: (nodeId: string) => void
}

/**
 * Карточка секции страницы (редактор v5, модель владельца 11.09): страница —
 * стопка блоков, блок двигается стрелками по вертикали и скрывается галочкой;
 * блок вкладок раскрывает вкладки (скрытие + вложенная зона полей или колонки
 * таблицы), зона полей — DnD-сетка.
 */
export const CustomizeFormSectionCard: FC<CustomizeFormSectionCardProps> = ({
  section,
  canMoveUp,
  canMoveDown,
  busy,
  selectedId,
  onMove,
  onToggleSection,
  onToggleTab,
  onToggleColumn,
  onZoneChange,
  onSelect,
}) => {
  const { t } = useTranslation()

  const renderTab = (tab: TabInfo) => (
    <div key={tab.nodeId} className="flex flex-col">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox
          size="small"
          checked={!tab.hidden}
          onChange={() => {
            onToggleTab(tab.nodeId)
          }}
          disabled={busy}
        />
        <Typography variant="body2">{tab.title}</Typography>
      </label>
      {!tab.hidden && tab.zone && (
        <div className="mb-1 ml-9">
          <CustomizeFormGridEditor
            zones={[tab.zone]}
            selectedId={selectedId}
            busy={busy}
            onSelect={onSelect}
            onChange={(zones) => {
              onZoneChange(tab.zone?.zoneId ?? '', zones[0])
            }}
          />
        </div>
      )}
      {!tab.hidden && tab.tableColumns && tab.tableColumns.length > 0 && (
        <details className="ml-9">
          <summary className="text-ui-05 cursor-pointer text-sm select-none">
            {t('sdui.customizeForm.tableColumns')}
          </summary>
          <div className="flex flex-col">
            {tab.tableColumns.map((column) => (
              <label
                key={column.nodeId}
                className="flex cursor-pointer items-center gap-2"
              >
                <Checkbox
                  size="small"
                  checked={!column.hidden}
                  onChange={() => {
                    onToggleColumn(tab.nodeId, column.nodeId)
                  }}
                  disabled={busy}
                />
                <Typography variant="body2">{column.label}</Typography>
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  )

  return (
    <div
      className={cn(
        'border-ui-03 rounded-lg border',
        section.hidden && 'opacity-50'
      )}
    >
      <div className="bg-ui-02 flex items-center gap-1 rounded-t-lg px-2 py-1">
        {section.hidable ? (
          <Checkbox
            size="small"
            checked={!section.hidden}
            onChange={onToggleSection}
            disabled={busy}
          />
        ) : (
          <span className="w-9" />
        )}
        <Typography variant="body2" className="min-w-0 flex-1 truncate">
          {section.kind === 'tabs'
            ? t('sdui.customizeForm.tabsSection', { tabs: section.label })
            : section.label}
        </Typography>
        <IconButton
          size="small"
          onClick={() => {
            onMove(-1)
          }}
          disabled={busy || !canMoveUp}
          aria-label={t('sdui.customizeForm.moveUp', { label: section.label })}
        >
          ↑
        </IconButton>
        <IconButton
          size="small"
          onClick={() => {
            onMove(1)
          }}
          disabled={busy || !canMoveDown}
          aria-label={t('sdui.customizeForm.moveDown', {
            label: section.label,
          })}
        >
          ↓
        </IconButton>
      </div>
      {!section.hidden && section.zone && (
        <div className="p-1">
          <CustomizeFormGridEditor
            zones={[section.zone]}
            selectedId={selectedId}
            busy={busy}
            onSelect={onSelect}
            onChange={(zones) => {
              onZoneChange(section.zone?.zoneId ?? '', zones[0])
            }}
          />
        </div>
      )}
      {!section.hidden && section.tabs && (
        <div className="flex flex-col px-2 py-1">
          {section.tabs.map(renderTab)}
        </div>
      )}
    </div>
  )
}

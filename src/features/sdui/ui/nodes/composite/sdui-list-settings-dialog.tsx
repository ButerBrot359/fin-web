import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'

import type { useSduiDispatch } from '../../../lib/dispatch'
import type { ViewNode } from '../../../types/view'
import type { ListFilterChip } from './list-filter-chips'
import type { ListSortState } from './list-column-defs'

type SettingsTab = 'basic' | 'filter' | 'sorting' | 'formatting' | 'grouping'

interface SduiListSettingsDialogProps {
  open: boolean
  columns: ViewNode[]
  visibility: Record<string, boolean>
  sortState: ListSortState | undefined
  sortCommand: string | undefined
  filterChips: ListFilterChip[]
  canClearFilters: boolean
  nodeId: string
  dispatch: ReturnType<typeof useSduiDispatch>
  onClose: () => void
  onVisibilityChange: (next: Record<string, boolean>) => void
  onRemoveFilter: (field: string) => void
  onClearFilters: () => void
}

const tabs: SettingsTab[] = [
  'basic',
  'filter',
  'sorting',
  'formatting',
  'grouping',
]

/**
 * The 1C list-settings dialog for SDUI LIST nodes. It deliberately consumes
 * server capabilities only: columns are a receiver concern; sorting and filter
 * removal dispatch the opaque commands supplied by the current list node.
 */
export const SduiListSettingsDialog: FC<SduiListSettingsDialogProps> = ({
  open,
  columns,
  visibility,
  sortState,
  sortCommand,
  filterChips,
  canClearFilters,
  nodeId,
  dispatch,
  onClose,
  onVisibilityChange,
  onRemoveFilter,
  onClearFilters,
}) => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<SettingsTab>('basic')

  const fields = useMemo(
    () =>
      columns.map((column) => ({
        id: column.id,
        label:
          typeof column.props?.header === 'string'
            ? column.props.header
            : column.id,
        sortable: column.props?.sortable === true,
        attributeCode: (column.props?.attributeCode ??
          column.props?.binding) as string | undefined,
      })),
    [columns]
  )
  const sortableFields = fields.filter(
    (field) => field.sortable && field.attributeCode
  )

  const setVisible = (id: string, visible: boolean) => {
    onVisibilityChange({ ...visibility, [id]: visible })
  }

  const applySort = (column: string, dir: 'ASC' | 'DESC') => {
    if (!sortCommand || !column) return
    void dispatch({
      type: 'COMMAND',
      command: sortCommand,
      value: { column, dir },
      sourceNodeId: nodeId,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('sdui.listSettings.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1} role="tablist" sx={{ mb: 2 }}>
          {tabs.map((item) => (
            <Button
              key={item}
              role="tab"
              aria-selected={tab === item}
              variant={tab === item ? 'contained' : 'text'}
              onClick={() => {
                setTab(item)
              }}
            >
              {t(`sdui.listSettings.tabs.${item}`)}
            </Button>
          ))}
        </Stack>

        {tab === 'basic' && (
          <Stack spacing={1}>
            <Typography>{t('sdui.listSettings.visibleColumns')}</Typography>
            {fields.map((field) => (
              <FormControlLabel
                key={field.id}
                control={
                  <Checkbox
                    checked={visibility[field.id] ?? true}
                    onChange={(event) => {
                      setVisible(field.id, event.target.checked)
                    }}
                  />
                }
                label={field.label}
              />
            ))}
          </Stack>
        )}

        {tab === 'filter' && (
          <Stack spacing={1}>
            <Typography>{t('sdui.listSettings.activeFilters')}</Typography>
            {filterChips.length === 0 ? (
              <Typography color="text.secondary">
                {t('sdui.listSettings.noFilters')}
              </Typography>
            ) : (
              filterChips.map((chip) => (
                <Stack
                  key={chip.field}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography>{chip.label}</Typography>
                  <Button
                    size="small"
                    onClick={() => {
                      onRemoveFilter(chip.field)
                    }}
                  >
                    {t('sdui.listSettings.removeFilter')}
                  </Button>
                </Stack>
              ))
            )}
            <Button
              sx={{ alignSelf: 'flex-start' }}
              disabled={!canClearFilters || filterChips.length === 0}
              onClick={onClearFilters}
            >
              {t('sdui.listSettings.clearFilters')}
            </Button>
          </Stack>
        )}

        {tab === 'sorting' && (
          <Stack spacing={2} sx={{ maxWidth: 420 }}>
            {!sortCommand ? (
              <Typography color="text.secondary">
                {t('sdui.listSettings.sortUnavailable')}
              </Typography>
            ) : (
              <>
                <FormControl fullWidth>
                  <InputLabel id="sdui-list-settings-sort-field-label">
                    {t('sdui.listSettings.sortField')}
                  </InputLabel>
                  <Select
                    labelId="sdui-list-settings-sort-field-label"
                    label={t('sdui.listSettings.sortField')}
                    value={sortState?.column ?? ''}
                    onChange={(event) => {
                      applySort(event.target.value, sortState?.dir ?? 'ASC')
                    }}
                  >
                    {sortableFields.map((field) => (
                      <MenuItem key={field.id} value={field.attributeCode}>
                        {field.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth disabled={!sortState?.column}>
                  <InputLabel id="sdui-list-settings-sort-direction-label">
                    {t('sdui.listSettings.sortDirection')}
                  </InputLabel>
                  <Select
                    labelId="sdui-list-settings-sort-direction-label"
                    label={t('sdui.listSettings.sortDirection')}
                    value={sortState?.dir ?? 'ASC'}
                    onChange={(event) => {
                      if (sortState?.column) {
                        applySort(sortState.column, event.target.value)
                      }
                    }}
                  >
                    <MenuItem value="ASC">
                      {t('sdui.listSettings.asc')}
                    </MenuItem>
                    <MenuItem value="DESC">
                      {t('sdui.listSettings.desc')}
                    </MenuItem>
                  </Select>
                </FormControl>
              </>
            )}
          </Stack>
        )}

        {(tab === 'formatting' || tab === 'grouping') && (
          <Typography color="text.secondary">
            {t(`sdui.listSettings.${tab}Unavailable`)}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sdui.listSettings.done')}</Button>
      </DialogActions>
    </Dialog>
  )
}

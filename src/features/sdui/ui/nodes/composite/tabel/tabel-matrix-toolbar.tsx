import { useState, type FC, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import type { TabelManualWorkKind } from './tabel-matrix-contract'

interface TabelMatrixToolbarProps {
  busy: boolean
  hasActiveEmployee: boolean
  manualWorkKinds: TabelManualWorkKind[]
  query: string
  onQueryChange: (q: string) => void
  onAddEmployee: () => void
  onOpenPodbor: () => void
  onAddWorkKind: (kind: TabelManualWorkKind) => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

/** Командная панель матрицы. Серверные команды (Заполнить/Очистить/…) сюда
 * не входят — они живут в командной панели формы от бэка (spec v1 §6). */
export const TabelMatrixToolbar: FC<TabelMatrixToolbarProps> = ({
  busy,
  hasActiveEmployee,
  manualWorkKinds,
  query,
  onQueryChange,
  onAddEmployee,
  onOpenPodbor,
  onAddWorkKind,
  onExpandAll,
  onCollapseAll,
}) => {
  const { t } = useTranslation()
  const [kindAnchor, setKindAnchor] = useState<HTMLElement | null>(null)

  const addKindDisabled =
    busy || !hasActiveEmployee || manualWorkKinds.length === 0
  const addKindButton = (
    <Button
      variant="secondary"
      disabled={addKindDisabled}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        setKindAnchor(e.currentTarget)
      }}
      endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
    >
      {t('sdui.tabel.addWorkKind')}
    </Button>
  )

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" disabled={busy} onClick={onAddEmployee}>
        {t('sdui.tabel.addEmployee')}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={onOpenPodbor}>
        {t('sdui.tabel.podbor')}
      </Button>
      {!hasActiveEmployee && !busy && manualWorkKinds.length > 0 ? (
        // span-обёртка обязательна: без неё tooltip не работает на disabled-кнопке
        <Tooltip title={t('sdui.tabel.selectEmployeeFirst')}>
          <span style={{ display: 'inline-flex' }}>{addKindButton}</span>
        </Tooltip>
      ) : (
        addKindButton
      )}
      <Menu
        anchorEl={kindAnchor}
        open={Boolean(kindAnchor)}
        onClose={() => {
          setKindAnchor(null)
        }}
      >
        {/* manualWorkKinds — единственный источник списка (spec v1 §3):
            не строим его из отображённых строк и не тянем весь классификатор */}
        {manualWorkKinds.map((kind) => (
          <MenuItem
            key={kind.workTimeKindRef}
            onClick={() => {
              setKindAnchor(null)
              onAddWorkKind(kind)
            }}
          >
            {kind.presentation}
          </MenuItem>
        ))}
      </Menu>
      <div className="flex-1" />
      <TextField
        size="small"
        placeholder={t('table.searchPlaceholder')}
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && query) {
            onQueryChange('')
            e.stopPropagation()
          }
        }}
        sx={{ width: 200 }}
        slotProps={{
          input: {
            endAdornment: query ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => {
                    onQueryChange('')
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
      <Tooltip title={t('sdui.tabel.expandAll')}>
        <IconButton size="small" onClick={onExpandAll}>
          <UnfoldMoreIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('sdui.tabel.collapseAll')}>
        <IconButton size="small" onClick={onCollapseAll}>
          <UnfoldLessIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

import { Button } from '@/shared/ui/buttons'

interface TableToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canAdd?: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  allowAdd?: boolean
  allowReorder?: boolean
  allowDelete?: boolean
}

export const TableToolbar = ({
  onAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  canAdd = true,
  canMoveUp,
  canMoveDown,
  canRemove,
  allowAdd = true,
  allowReorder = true,
  allowDelete = true,
}: TableToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      {allowAdd && (
        <Button variant="primary" disabled={!canAdd} onClick={onAdd}>
          {t('table.add')}
        </Button>
      )}
      {allowDelete && (
        <Button
          variant="secondary"
          disabled={!canRemove}
          onClick={onRemove}
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 20 }} />}
        />
      )}
      {allowReorder && (
        <>
          <Button
            variant="secondary"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            startIcon={<KeyboardArrowUpIcon sx={{ fontSize: 20 }} />}
          />
          <Button
            variant="secondary"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            startIcon={<KeyboardArrowDownIcon sx={{ fontSize: 20 }} />}
          />
        </>
      )}
    </div>
  )
}

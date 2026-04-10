import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

import { Button } from '@/shared/ui/buttons'

interface TableFieldToolbarProps {
  onAdd: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
}

export const TableFieldToolbar = ({
  onAdd,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  canRemove,
}: TableFieldToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" onClick={onAdd}>
        {t('table.add')}
      </Button>
      <Button
        variant="secondary"
        disabled={!canRemove}
        onClick={onRemove}
        startIcon={<DeleteOutlineIcon sx={{ fontSize: 20 }} />}
      />
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
    </div>
  )
}

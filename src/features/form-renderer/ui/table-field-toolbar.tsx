import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

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
      <button
        type="button"
        onClick={onAdd}
        className="cursor-pointer whitespace-nowrap rounded-md bg-accent-01 px-4 py-2 text-body2 font-medium text-ui-06 hover:bg-accent-01/80"
      >
        {t('table.add')}
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="flex cursor-pointer items-center justify-center rounded-md bg-ui-01 p-2 text-ui-05 hover:bg-ui-02 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <DeleteOutlineIcon sx={{ fontSize: 20 }} />
      </button>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={!canMoveUp}
        className="flex cursor-pointer items-center justify-center rounded-md bg-ui-01 p-2 text-ui-05 hover:bg-ui-02 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={!canMoveDown}
        className="flex cursor-pointer items-center justify-center rounded-md bg-ui-01 p-2 text-ui-05 hover:bg-ui-02 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
      </button>
    </div>
  )
}

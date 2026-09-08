import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, MenuItem } from '@mui/material'

import CopyDocIcon from '@/shared/assets/icons/copy-doc.svg'
import SearchIcon from '@/shared/assets/icons/search.svg'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { SearchInput } from '@/shared/ui/inputs'

export interface InformationRegisterListCommands {
  onCreate: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
  /** Ровно одна выделенная строка — команды над записью без неё недоступны. */
  hasSelection: boolean
  isDeleting: boolean
}

interface InformationRegisterListToolbarProps extends InformationRegisterListCommands {
  /** Строка поиска контролируется страницей — значение уходит в FilterRequest.q. */
  searchValue: string
  onSearchChange: (value: string) => void
}

/**
 * Тулбар списка регистра сведений — команды формы списка 1С
 * («Создать», «Скопировать» F9, «Изменить» F2, «Удалить» Del, «Обновить» F5).
 *
 * <p>Раньше здесь была одна кнопка «Создать»: правка открывалась двойным кликом,
 * копирования и удаления в UI не было вовсе. Команды выведены на панель И
 * продублированы в «Ещё» — ровно как в 1С, где обе точки входа показывают один
 * список.
 *
 * <p>Пунктов 1С, которых у нас нет («Установить период…», «Настроить список…»,
 * «Изменить форму…», «Получить ссылку…»), здесь НЕТ намеренно: пустая кнопка
 * выглядит как сломанная команда. Отбор и сортировка живут в шапке таблицы.
 */
export const InformationRegisterListToolbar = ({
  onCreate,
  onCopy,
  onEdit,
  onDelete,
  onRefresh,
  hasSelection,
  isDeleting,
  searchValue,
  onSearchChange,
}: InformationRegisterListToolbarProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between pb-3">
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={onCreate}>
          {t('actions.create')}
        </Button>
        <Button
          variant="secondary"
          aria-label={t('actions.copy')}
          disabled={!hasSelection}
          startIcon={<CopyDocIcon className="h-5 w-5" />}
          onClick={onCopy}
        />
        <Button variant="secondary" disabled={!hasSelection} onClick={onEdit}>
          {t('actions.change')}
        </Button>
        <Button
          variant="secondary"
          disabled={!hasSelection || isDeleting}
          onClick={onDelete}
        >
          {t('actions.delete')}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <SearchInput
          placeholder={t('pageToolbar.search')}
          value={searchValue}
          className="w-64 bg-ui-01"
          onChange={(e) => {
            onSearchChange(e.target.value)
          }}
          startIcon={<SearchIcon className="h-5 w-5 text-ui-05" />}
        />
        <InformationRegisterMoreDropdown
          onCreate={onCreate}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDelete}
          onRefresh={onRefresh}
          hasSelection={hasSelection}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  )
}

/** «Ещё» — тот же набор команд, что на панели, плюс «Обновить». */
const InformationRegisterMoreDropdown = ({
  onCreate,
  onCopy,
  onEdit,
  onDelete,
  onRefresh,
  hasSelection,
  isDeleting,
}: InformationRegisterListCommands) => {
  const { t } = useTranslation()
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const close = () => {
    setAnchor(null)
  }
  const run = (command: () => void) => () => {
    close()
    command()
  }

  return (
    <div ref={anchorRef} className="inline-flex">
      <DropdownButton
        label={t('documentListToolbar.more')}
        onClick={() => {
          setAnchor(anchorRef.current)
        }}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem onClick={run(onCreate)}>{t('actions.create')}</MenuItem>
        <MenuItem disabled={!hasSelection} onClick={run(onCopy)}>
          {t('actions.copy')}
        </MenuItem>
        <MenuItem disabled={!hasSelection} onClick={run(onEdit)}>
          {t('actions.change')}
        </MenuItem>
        <MenuItem
          disabled={!hasSelection || isDeleting}
          onClick={run(onDelete)}
        >
          {t('actions.delete')}
        </MenuItem>
        <MenuItem onClick={run(onRefresh)}>
          {t('documentListToolbar.refresh')}
        </MenuItem>
      </Menu>
    </div>
  )
}

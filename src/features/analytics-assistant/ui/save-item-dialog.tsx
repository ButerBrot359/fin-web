import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, Typography } from '@mui/material'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'
import { TextInput, TextareaInput } from '@/shared/ui/inputs'

export interface SaveItemValues {
  titleRu: string
  titleKz: string
  description: string
}

interface SaveItemDialogProps {
  open: boolean
  /** Предзаполнение названия — `spec.title` построенного представления. */
  defaultTitle: string
  isPending: boolean
  onClose: () => void
  onSave: (values: SaveItemValues) => void
}

/** Сохранение построенного представления в раздел «Аналитика». */
export const SaveItemDialog = ({
  open,
  defaultTitle,
  isPending,
  onClose,
  onSave,
}: SaveItemDialogProps) => {
  const { t } = useTranslation()
  const [titleRu, setTitleRu] = useState(defaultTitle)
  const [titleKz, setTitleKz] = useState('')
  const [description, setDescription] = useState('')

  // Открытие диалога — снова подставляем заголовок из текущей спецификации.
  // Правка состояния прямо в рендере по смене пропа, а не в эффекте: эффект
  // здесь дал бы лишний проход рендера с устаревшим заголовком.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTitleRu(defaultTitle)
  }

  const canSave = titleRu.trim().length > 0 && !isPending

  const handleSave = () => {
    if (!canSave) return
    onSave({
      titleRu: titleRu.trim(),
      titleKz: titleKz.trim(),
      description: description.trim(),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <Typography variant="h6" className="flex-1 font-bold text-ui-06">
            {t('analytics.item.saveTitle')}
          </Typography>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('actions.close')}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <TextInput
          label={t('analytics.item.name')}
          value={titleRu}
          onChange={(event) => {
            setTitleRu(event.target.value)
          }}
          fullWidth
          size="small"
        />
        <TextInput
          label={t('analytics.item.nameKz')}
          value={titleKz}
          onChange={(event) => {
            setTitleKz(event.target.value)
          }}
          fullWidth
          size="small"
        />
        <TextareaInput
          label={t('analytics.item.description')}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value)
          }}
          fullWidth
          size="small"
        />

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!canSave}
            onClick={handleSave}
          >
            {t('analytics.item.save')}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

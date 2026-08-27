import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'

import { bulkEditDocumentEntries } from '@/entities/document-entry'
import { invalidateDocumentListQueries } from '@/shared/lib/query/invalidate-entities'
import { getApiErrorMessage } from '@/shared/lib/utils/get-api-error-message'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

interface TabelBulkEditButtonProps {
  /** Код типа документа — уходит в per-type bulk-edit endpoint. */
  typeCode: string
  selectedIds: number[]
}

/**
 * «Изменить выделенные…» (SCRUM-276 spec v2 §2.3/§3.3): массовая смена только
 * комментария у выделенных непроведённых Табелей. Явный opt-in чекбокс —
 * без него сервер данные не меняет. Ошибка не сбрасывает selection и не
 * показывает ложный успех; успех перезапрашивает текущий list-state.
 */
export const TabelBulkEditButton = ({
  typeCode,
  selectedIds,
}: TabelBulkEditButtonProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [commentEnabled, setCommentEnabled] = useState(false)
  const [comment, setComment] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      bulkEditDocumentEntries(typeCode, {
        selectedEntryIds: selectedIds,
        commentEnabled,
        comment,
      }),
    onSuccess: (response) => {
      const result = response.data.data
      invalidateDocumentListQueries(queryClient)
      showToast(
        'success',
        t('documentListToolbar.bulkEditSuccess', {
          changed: result.changedCount,
          selected: result.selectedCount,
        })
      )
      setOpen(false)
    },
    onError: (error) => {
      showToast(
        'error',
        getApiErrorMessage(error) ?? t('documentListToolbar.bulkEditError')
      )
    },
  })

  const handleOpen = () => {
    setCommentEnabled(false)
    setComment('')
    setOpen(true)
  }

  return (
    <>
      <Button
        variant="secondary"
        disabled={selectedIds.length === 0}
        onClick={handleOpen}
      >
        {t('documentListToolbar.editSelected')}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('documentListToolbar.bulkEditTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('documentListToolbar.bulkEditCount', {
              count: selectedIds.length,
            })}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={commentEnabled}
                onChange={(e) => {
                  setCommentEnabled(e.target.checked)
                }}
              />
            }
            label={t('documentListToolbar.bulkEditCommentSwitch')}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            disabled={!commentEnabled}
            value={comment}
            placeholder={t('documentListToolbar.bulkEditCommentPlaceholder')}
            onChange={(e) => {
              setComment(e.target.value)
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false)
            }}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={mutation.isPending || !commentEnabled}
            onClick={() => {
              mutation.mutate()
            }}
          >
            {t('tableFilter.apply')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

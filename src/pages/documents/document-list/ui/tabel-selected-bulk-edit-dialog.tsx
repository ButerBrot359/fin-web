import { useState } from 'react'
import {
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  bulkEditSelectedTabelEntries,
  type TabelSelectedBulkEditResult,
} from '@/entities/document-entry'
import { invalidateDocumentListQueries } from '@/shared/lib/query/invalidate-entities'
import { TextareaInput } from '@/shared/ui/inputs'
import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

interface TabelSelectedBulkEditDialogProps {
  open: boolean
  selectedEntryIds: number[]
  onClose: () => void
}

const errorMessage = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined
  const apiError = error as { message?: string; data?: { message?: string } }
  return apiError.data?.message ?? apiError.message
}

const TabelSelectedBulkEditDialogContents = ({
  selectedEntryIds,
  onClose,
}: Omit<TabelSelectedBulkEditDialogProps, 'open'>) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [commentEnabled, setCommentEnabled] = useState(false)
  const [comment, setComment] = useState('')
  const [result, setResult] = useState<TabelSelectedBulkEditResult | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      bulkEditSelectedTabelEntries({
        selectedEntryIds,
        commentEnabled,
        comment,
      }),
    onSuccess: (response) => {
      setResult(response.data.data)
      invalidateDocumentListQueries(queryClient)
    },
    onError: (error) => {
      showToast('error', t('tabelBulkEdit.error'), errorMessage(error))
    },
  })

  const isComplete = result !== null

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={mutation.isPending ? undefined : onClose}
    >
      <DialogTitle>
        {t('tabelBulkEdit.title', { count: selectedEntryIds.length })}
      </DialogTitle>
      <DialogContent>
        {mutation.isPending ? (
          <div className="flex items-center gap-3 py-5">
            <CircularProgress size={24} />
            <Typography>{t('tabelBulkEdit.processing')}</Typography>
          </div>
        ) : isComplete ? (
          <Typography>
            {t('tabelBulkEdit.completed', { count: result.changedCount })}
          </Typography>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <Typography variant="body2">
              {t('tabelBulkEdit.selectedCount', {
                count: selectedEntryIds.length,
              })}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={commentEnabled}
                  onChange={(_, checked) => {
                    setCommentEnabled(checked)
                  }}
                />
              }
              label={t('tabelBulkEdit.comment')}
            />
            <TextareaInput
              fullWidth
              disabled={!commentEnabled}
              label={t('tabelBulkEdit.newValue')}
              value={comment}
              onChange={(event) => {
                setComment(event.target.value)
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('tabelBulkEdit.atomicOnly')}
            </Typography>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {isComplete ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null)
              }}
            >
              {t('actions.back')}
            </Button>
            <Button variant="primary" onClick={onClose}>
              {t('tabelBulkEdit.done')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!commentEnabled || mutation.isPending}
              onClick={() => {
                mutation.mutate()
              }}
            >
              {t('tabelBulkEdit.apply')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export const TabelSelectedBulkEditDialog = (
  props: TabelSelectedBulkEditDialogProps
) => (props.open ? <TabelSelectedBulkEditDialogContents {...props} /> : null)

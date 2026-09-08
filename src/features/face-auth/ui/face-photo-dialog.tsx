import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'

import {
  fetchFaceTemplates,
  revokeFaceTemplate,
  uploadFaceTemplate,
} from '../api/face-template-endpoints'
import { useFaceTemplateImages } from '../lib/hooks/use-face-template-images'
import type {
  FaceTemplateSummary,
  FaceTemplateUploadOutcome,
} from '../types/face-template'
import { FacePhotoUpload } from './face-photo-upload'
import { FacePhotoView } from './face-photo-view'

interface FacePhotoDialogProps {
  open: boolean
  userId: number
  onClose: () => void
}

const faceTemplatesQueryKey = (userId: number) => ['face-template', userId]

const activeTemplates = (
  templates: FaceTemplateSummary[] | undefined
): FaceTemplateSummary[] =>
  [...(templates ?? [])]
    .filter((template) => template.status === 'ACTIVE')
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))

export const FacePhotoDialog = ({
  open,
  userId,
  onClose,
}: FacePhotoDialogProps) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [outcome, setOutcome] = useState<FaceTemplateUploadOutcome | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const { data: templates, isPending } = useQuery({
    queryKey: faceTemplatesQueryKey(userId),
    queryFn: () => fetchFaceTemplates(userId),
    enabled: open,
  })

  const active = activeTemplates(templates)
  const imageUrls = useFaceTemplateImages(
    userId,
    open ? active.map((template) => template.templateId) : []
  )

  const upload = useMutation({
    mutationFn: (picked: File) => uploadFaceTemplate(userId, picked),
    onSuccess: (result) => {
      setOutcome(result)
      if (result.kind !== 'enrolled') {
        return
      }
      setAdding(false)
      setFile(null)
      void queryClient.invalidateQueries({
        queryKey: faceTemplatesQueryKey(userId),
      })
    },
  })

  const revoke = useMutation({
    mutationFn: (templateId: number) => revokeFaceTemplate(userId, templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: faceTemplatesQueryKey(userId),
      })
    },
    onError: () => {
      setDeleteFailed(true)
    },
  })

  const handleClose = () => {
    setAdding(false)
    setFile(null)
    setOutcome(null)
    setConfirmingId(null)
    setDeleteFailed(false)
    onClose()
  }

  const showView = active.length > 0 && !adding

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('auth.face.photo.title')}</DialogTitle>

      <DialogContent className="flex flex-col gap-3">
        {isPending && (
          <Typography variant="body2">
            {t('auth.face.photo.checking')}
          </Typography>
        )}

        {!isPending && showView && (
          <FacePhotoView
            templates={active}
            imageUrls={imageUrls}
            deletingId={revoke.isPending ? revoke.variables : null}
            onDelete={(templateId) => {
              setDeleteFailed(false)
              setConfirmingId(templateId)
            }}
          />
        )}

        {deleteFailed && (
          <Typography variant="caption" color="error" role="alert">
            {t('auth.face.photo.errorDeleteFailed')}
          </Typography>
        )}

        {!isPending && !showView && (
          <FacePhotoUpload outcome={outcome} onFileChange={setFile} />
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="secondary" onClick={handleClose}>
          {t(showView ? 'actions.close' : 'actions.cancel')}
        </Button>

        {showView ? (
          <Button
            variant="primary"
            onClick={() => {
              setOutcome(null)
              setAdding(true)
            }}
          >
            {t('auth.face.photo.replace')}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={file === null || upload.isPending}
            onClick={() => {
              if (file !== null) {
                upload.mutate(file)
              }
            }}
          >
            {upload.isPending
              ? t('auth.face.photo.uploading')
              : t('auth.face.photo.submit')}
          </Button>
        )}
      </DialogActions>

      <ConfirmDialog
        open={confirmingId !== null}
        title={t('auth.face.photo.deleteTitle')}
        message={t('auth.face.photo.deleteMessage')}
        confirmLabel={t('auth.face.photo.delete')}
        cancelLabel={t('actions.cancel')}
        onConfirm={() => {
          if (confirmingId !== null) {
            revoke.mutate(confirmingId)
          }
          setConfirmingId(null)
        }}
        onCancel={() => {
          setConfirmingId(null)
        }}
      />
    </Dialog>
  )
}

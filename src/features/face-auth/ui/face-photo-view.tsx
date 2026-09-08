import { useTranslation } from 'react-i18next'

import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { IconButton, Typography } from '@mui/material'

import { formatDateTime } from '@/shared/lib/utils/date'

import type { FaceTemplateSummary } from '../types/face-template'

interface FacePhotoViewProps {
  templates: FaceTemplateSummary[]
  imageUrls: Record<number, string | undefined>
  deletingId: number | null
  onDelete: (templateId: number) => void
}

export const FacePhotoView = ({
  templates,
  imageUrls,
  deletingId,
  onDelete,
}: FacePhotoViewProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <Typography variant="body2">
        {t('auth.face.photo.activeCount', { count: templates.length })}
      </Typography>

      <div className="flex flex-wrap justify-center gap-4">
        {templates.map((template) => (
          <div
            key={template.templateId}
            className="flex w-32 flex-col items-center gap-1"
          >
            {imageUrls[template.templateId] === undefined ? (
              <div className="h-32 w-32 animate-pulse rounded-full bg-ui-01" />
            ) : (
              <img
                src={imageUrls[template.templateId]}
                alt={t('auth.face.photo.previewAlt')}
                className="h-32 w-32 rounded-full object-cover"
              />
            )}

            <Typography variant="caption" className="text-center text-ui-05">
              {formatDateTime(template.enrolledAt)}
            </Typography>

            <IconButton
              size="small"
              aria-label={t('auth.face.photo.delete')}
              disabled={deletingId !== null}
              onClick={() => {
                onDelete(template.templateId)
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircularProgress } from '@mui/material'

import { showToast } from '@/shared/ui/toast/show-toast'

import { useGenerateFormConfig } from '../lib/hooks/use-generate-form-config'
import { RegenerateConfirmModal } from './regenerate-confirm-modal'

interface AiButtonProps {
  moduleCode: string
  type: 'documents' | 'dictionaries'
  domain?: string
  configExists: boolean
  onSuccess: () => void
  onPendingChange?: (isPending: boolean) => void
}

export const AiButton = ({
  moduleCode,
  type,
  domain,
  configExists,
  onSuccess,
  onPendingChange,
}: AiButtonProps) => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { mutate, isPending } = useGenerateFormConfig({
    moduleCode,
    type,
    domain,
    onSuccess,
  })

  useEffect(() => {
    onPendingChange?.(isPending)
  }, [isPending]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (configExists) {
      setIsModalOpen(true)
    } else {
      mutate(undefined, {
        onError: () => {
          showToast('error', t('aiConfig.generateError'))
        },
      })
    }
  }

  const handleConfirmRegenerate = () => {
    setIsModalOpen(false)
    mutate(undefined, {
      onError: () => {
        showToast('error', t('aiConfig.generateError'))
      },
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="flex cursor-pointer items-center justify-center rounded-md px-4 py-2 text-body2 font-semibold text-white transition-all hover:opacity-85 hover:shadow-secondary-hover active:opacity-75 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:shadow-none"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        }}
      >
        {isPending ? (
          <CircularProgress size={16} sx={{ color: 'white' }} />
        ) : (
          'AI'
        )}
      </button>

      <RegenerateConfirmModal
        open={isModalOpen}
        onConfirm={handleConfirmRegenerate}
        onCancel={() => setIsModalOpen(false)}
      />
    </>
  )
}

import { useState } from 'react'
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
}

export const AiButton = ({
  moduleCode,
  type,
  domain,
  configExists,
  onSuccess,
}: AiButtonProps) => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { mutate, isPending } = useGenerateFormConfig({
    moduleCode,
    type,
    domain,
    onSuccess,
  })

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
        className="flex min-w-[56px] cursor-pointer items-center justify-center rounded-md px-5 py-2.5 text-body2 font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          background: isPending
            ? 'linear-gradient(135deg, #818cf8, #a78bfa)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
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

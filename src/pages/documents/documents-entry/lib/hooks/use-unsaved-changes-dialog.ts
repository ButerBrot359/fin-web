import { useState } from 'react'

interface UseUnsavedChangesDialogParams {
  onSave: () => void
  onDiscard: () => void
}

export const useUnsavedChangesDialog = ({
  onSave,
  onDiscard,
}: UseUnsavedChangesDialogParams) => {
  const [isOpen, setIsOpen] = useState(false)

  const open = () => {
    setIsOpen(true)
  }

  const handleSave = () => {
    setIsOpen(false)
    onSave()
  }

  const handleDiscard = () => {
    setIsOpen(false)
    onDiscard()
  }

  const handleCancel = () => {
    setIsOpen(false)
  }

  return { isOpen, open, handleSave, handleDiscard, handleCancel }
}

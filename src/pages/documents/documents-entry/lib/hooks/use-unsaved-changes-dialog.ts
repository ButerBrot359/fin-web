import { useState, useCallback } from 'react'

interface UseUnsavedChangesDialogParams {
  onSave: () => void
  onDiscard: () => void
}

export const useUnsavedChangesDialog = ({
  onSave,
  onDiscard,
}: UseUnsavedChangesDialogParams) => {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const handleSave = useCallback(() => {
    setIsOpen(false)
    onSave()
  }, [onSave])

  const handleDiscard = useCallback(() => {
    setIsOpen(false)
    onDiscard()
  }, [onDiscard])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
  }, [])

  return { isOpen, open, handleSave, handleDiscard, handleCancel }
}

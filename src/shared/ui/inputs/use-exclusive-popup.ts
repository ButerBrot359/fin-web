import { useCallback, useEffect, useId, useRef, useState } from 'react'

const POPUP_OWNER_ATTR = 'data-popup-owner'

let closeActivePopup: (() => void) | null = null

export function useExclusivePopup(onOpen?: () => void) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const ownerId = useId()

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const handleClose = useCallback(() => {
    if (closeActivePopup === close) closeActivePopup = null
    setOpen(false)
  }, [close])

  const handleOpen = useCallback(() => {
    if (closeActivePopup && closeActivePopup !== close) closeActivePopup()
    closeActivePopup = close
    setOpen(true)
    onOpen?.()
  }, [close, onOpen])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (rootRef.current?.contains(target)) return
      const owner = target
        .closest(`[${POPUP_OWNER_ATTR}]`)
        ?.getAttribute(POPUP_OWNER_ATTR)
      if (owner === ownerId) return
      handleClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open, ownerId, handleClose])

  useEffect(
    () => () => {
      if (closeActivePopup === close) closeActivePopup = null
    },
    [close]
  )

  return {
    open,
    onOpen: handleOpen,
    onClose: handleClose,
    rootRef,
    popperOwnerProps: { [POPUP_OWNER_ATTR]: ownerId },
  }
}

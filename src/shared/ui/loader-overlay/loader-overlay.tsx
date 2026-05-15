import { useEffect, useRef, useState } from 'react'
import { Backdrop, CircularProgress } from '@mui/material'

import { useLoaderStore } from '@/shared/lib/loader/loader-store'

const SHOW_DELAY_MS = 200

export const LoaderOverlay = () => {
  const activeCount = useLoaderStore((state) => state.activeCount)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeCount === 0) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setVisible(false)
      return
    }

    if (visible || timerRef.current !== null) return

    timerRef.current = setTimeout(() => {
      setVisible(true)
      timerRef.current = null
    }, SHOW_DELAY_MS)
  }, [activeCount, visible])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <Backdrop
      open={visible}
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.modal + 1,
      }}
    >
      <CircularProgress color="inherit" />
    </Backdrop>
  )
}

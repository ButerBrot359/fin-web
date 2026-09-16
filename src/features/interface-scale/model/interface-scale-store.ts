import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const MIN_INTERFACE_SCALE = 0.5
export const MAX_INTERFACE_SCALE = 2
export const DEFAULT_INTERFACE_SCALE = 1
export const INTERFACE_SCALE_STEP = 0.1

const clamp = (scale: number) => {
  const rounded = Math.round(scale * 100) / 100
  if (!Number.isFinite(rounded)) return DEFAULT_INTERFACE_SCALE
  return Math.min(MAX_INTERFACE_SCALE, Math.max(MIN_INTERFACE_SCALE, rounded))
}

interface InterfaceScaleState {
  scale: number
  setScale: (scale: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetScale: () => void
}

export const useInterfaceScaleStore = create<InterfaceScaleState>()(
  persist(
    (set, get) => ({
      scale: DEFAULT_INTERFACE_SCALE,
      setScale: (scale) => {
        set({ scale: clamp(scale) })
      },
      zoomIn: () => {
        set({ scale: clamp(get().scale + INTERFACE_SCALE_STEP) })
      },
      zoomOut: () => {
        set({ scale: clamp(get().scale - INTERFACE_SCALE_STEP) })
      },
      resetScale: () => {
        set({ scale: DEFAULT_INTERFACE_SCALE })
      },
    }),
    {
      name: 'interface-scale',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ scale: state.scale }),
      merge: (persisted, current) => {
        const saved = (persisted as { scale?: unknown } | undefined)?.scale
        return {
          ...current,
          scale: typeof saved === 'number' ? clamp(saved) : current.scale,
        }
      },
    }
  )
)

import { create } from 'zustand'

export interface OpenFolder {
  id: number
  name: string
}

interface FolderNavigationStore {
  cache: Partial<Record<string, OpenFolder[]>>
  setFolders: (path: string, folders: OpenFolder[]) => void
  getFolders: (path: string) => OpenFolder[] | undefined
  removeFolders: (path: string) => void
}

export const useFolderNavigationStore = create<FolderNavigationStore>(
  (set, get) => ({
    cache: {},

    setFolders: (path, folders) => {
      set((state) => ({
        cache: { ...state.cache, [path]: folders },
      }))
    },

    getFolders: (path) => get().cache[path],

    removeFolders: (path) => {
      set((state) => {
        const { [path]: _, ...rest } = state.cache
        return { cache: rest }
      })
    },
  })
)

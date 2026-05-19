import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  useFolderNavigationStore,
  type OpenFolder,
} from './use-folder-navigation-store'

export const useFolderNavigation = () => {
  const location = useLocation()
  const path = location.pathname

  const store = useFolderNavigationStore()
  const [openFolders, setOpenFoldersLocal] = useState<OpenFolder[]>(
    () => store.getFolders(path) ?? []
  )

  const setFolders = (folders: OpenFolder[]) => {
    setOpenFoldersLocal(folders)
    store.setFolders(path, folders)
  }

  const openFolder = (folder: OpenFolder) => {
    setFolders([...openFolders, folder])
  }

  const closeFolder = (folderId: number) => {
    const index = openFolders.findIndex((f) => f.id === folderId)
    if (index === -1) return
    setFolders(openFolders.slice(0, index))
  }

  const currentParentId =
    openFolders.length > 0 ? openFolders[openFolders.length - 1].id : undefined

  return {
    openFolders,
    currentParentId,
    openFolder,
    closeFolder,
  }
}

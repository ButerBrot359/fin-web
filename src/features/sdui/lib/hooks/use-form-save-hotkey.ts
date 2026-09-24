import { useEffect, useRef, type RefObject } from 'react'

import { isEditableTarget } from '../utils/table-hotkeys'
import { useFormSaveCommand } from './use-form-save-command'

const ekranViden = (root: HTMLElement): boolean => {
  const pervyy = root.firstElementChild
  return pervyy !== null && pervyy.getClientRects().length > 0
}

const vnutriDialoga = (target: Element): boolean =>
  target.closest('[role="dialog"]') !== null

export function useFormSaveHotkey(rootRef: RefObject<HTMLElement | null>) {
  const save = useFormSaveCommand()
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      if (e.key.toLowerCase() !== 's' || e.defaultPrevented) return
      const root = rootRef.current
      if (root === null || !(e.target instanceof Element)) return
      const naFone =
        e.target === document.body || e.target === document.documentElement
      if (naFone ? !ekranViden(root) : !root.contains(e.target)) return
      if (vnutriDialoga(e.target)) return
      e.preventDefault()
      if (isEditableTarget(e.target) && e.target instanceof HTMLElement) {
        e.target.blur()
      }
      saveRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [rootRef])
}

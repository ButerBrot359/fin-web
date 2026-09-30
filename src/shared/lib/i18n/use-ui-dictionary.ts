import { useEffect, useState } from 'react'

import { ensureUiTranslations } from './ui-translation-loader'

export const useUiDictionary = (enabled: boolean): void => {
  const [, setVersion] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void ensureUiTranslations().then(() => {
      if (active) setVersion((version) => version + 1)
    })
    return () => {
      active = false
    }
  }, [enabled])
}

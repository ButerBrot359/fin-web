import { createTheme } from '@mui/material/styles'

import { fontFamily, semantic } from '@/shared/design/tokens'

import { inputsComponents } from './inputs'
import { menusComponents } from './menus'
import { pickersComponents } from './pickers'
import { tabsComponents } from './tabs'

export const theme = createTheme({
  // ВАЖНО: palette использует .value (hex-литерал), а не cssVar().
  // Причина: MUI augmentColor/alpha (decomposeColor) не парсит var()-строки и падает при createTheme.
  // Следствие: эти четыре цвета (primary, error, text.primary, text.secondary) не runtime-темизируемы.
  // Серверная тема фазы 2 потребует пересоздания темы для изменения этих цветов (см. спеку §4.1).
  // StyleOverrides используют cssVar() для рантайм CSS-переменных.
  palette: {
    primary: { main: semantic.primary.value },
    error: { main: semantic.error.value },
    text: {
      primary: semantic.textPrimary.value,
      secondary: semantic.textSecondary.value,
    },
  },
  // Google Sans для всей MUI-типографики (K-2 аудита Ф3): без этого h6 и
  // прочие variant'ы рендерились дефолтным Roboto.
  typography: {
    fontFamily,
  },
  components: {
    ...inputsComponents,
    ...menusComponents,
    ...tabsComponents,
    ...pickersComponents,
  },
})

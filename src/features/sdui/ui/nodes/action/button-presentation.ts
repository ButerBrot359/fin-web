export interface ButtonPresentation {
  muiVariant: 'text' | 'outlined' | 'contained'
  isDropdown: boolean
}

/**
 * Маппинг props.variant с бэка → MUI. text-dropdown — меню, выглядящее
 * ссылкой («Ещё...» в панели «Перейти» читается как продолжение ссылок-регистров,
 * а не как кнопка) — SCRUM-244 §2.5.
 */
export function resolveButtonPresentation(
  variant: string | undefined,
  hasChildren: boolean,
): ButtonPresentation {
  const isDropdown =
    (variant === 'dropdown' || variant === 'text-dropdown') && hasChildren

  const muiVariant =
    variant === 'contained' || variant === 'primary'
      ? 'contained'
      : variant === 'text' || variant === 'text-dropdown'
        ? 'text'
        : 'outlined'

  return { muiVariant, isDropdown }
}

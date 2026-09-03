export type SduiButtonVariant = 'primary' | 'secondary' | 'tertiary'

export interface ButtonPresentation {
  variant: SduiButtonVariant
  isDropdown: boolean
}

/**
 * Маппинг props.variant с бэка → варианты дизайн-системы (Figma, лист
 * «button» 40:601): primary — салатовая, secondary — белая, tertiary —
 * прозрачная с синим текстом; outlined-кнопок в макетах не существует,
 * поэтому исторический variant='outlined' с провода читается как secondary.
 * text-dropdown — меню, выглядящее ссылкой («Ещё...» в панели «Перейти»
 * читается как продолжение ссылок-регистров, а не как кнопка) — SCRUM-244 §2.5.
 */
export function resolveButtonPresentation(
  variant: string | undefined,
  hasChildren: boolean
): ButtonPresentation {
  const isDropdown =
    (variant === 'dropdown' || variant === 'text-dropdown') && hasChildren

  const uiVariant: SduiButtonVariant =
    variant === 'contained' || variant === 'primary'
      ? 'primary'
      : variant === 'text' || variant === 'text-dropdown'
        ? 'tertiary'
        : 'secondary'

  return { variant: uiVariant, isDropdown }
}

interface LocalizedNameable {
  nameRu?: string
  nameKz?: string
}

export const getLocalizedName = (
  obj: LocalizedNameable,
  language: string
): string => (language === 'kz' && obj.nameKz ? obj.nameKz : obj.nameRu) ?? ''

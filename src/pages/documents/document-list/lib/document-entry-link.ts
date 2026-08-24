/**
 * Canonical shareable document route. App resolves it to the module-specific
 * document card, so a copied link remains valid outside the current workspace tab.
 */
export const documentEntryLink = (
  typeCode: string,
  entryId: number,
  origin: string
) => new URL(`/documents/${typeCode}/${String(entryId)}`, origin).toString()

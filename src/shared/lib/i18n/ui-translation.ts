type Localized<T> = T extends string
  ? string
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly unknown[]
      ? { [K in keyof T]: Localized<T[K]> }
      : T extends object
        ? { [K in keyof T]: Localized<T[K]> }
        : T

const KZ_LANGUAGE = /^(?:kz|kk)(?:-|$)/i

let dictionary: Readonly<Record<string, string>> = {}

export const isKzLanguage = (language: string | undefined): boolean =>
  KZ_LANGUAGE.test(language ?? '')

export const setUiDictionary = (next: Record<string, string>): void => {
  dictionary = next
}

export const translateUi = (text: string, language: string): string =>
  isKzLanguage(language) ? (dictionary[text] ?? text) : text

export const formatUi = (
  template: string,
  values: Record<string, string | number>,
  language: string
): string =>
  translateUi(template, language).replace(
    /\{\{(\w+)\}\}/g,
    (placeholder, name: string) =>
      name in values ? String(values[name]) : placeholder
  )

export const localizeDeep = <T>(value: T, language: string): Localized<T> => {
  if (typeof value === 'string') {
    return translateUi(value, language) as Localized<T>
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) =>
      localizeDeep(item, language)
    ) as Localized<T>
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        localizeDeep(item, language),
      ])
    ) as Localized<T>
  }
  return value as Localized<T>
}

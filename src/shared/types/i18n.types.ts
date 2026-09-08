import type { ParseKeys } from 'i18next'

/**
 * Ключ перевода из `common.json`.
 *
 * Ресурсы i18next в проекте типизированы (`src/app/config/i18n/i18next.d.ts`),
 * поэтому `t()` принимает не любую строку, а союз существующих ключей. Там, где
 * ключ вычисляется (список примеров, подписи опций, сообщение валидации),
 * `string` не подходит — нужен этот тип.
 */
export type TranslationKey = ParseKeys

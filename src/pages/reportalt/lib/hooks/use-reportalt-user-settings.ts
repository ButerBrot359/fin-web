import { useEffect, useMemo, useState } from 'react'

import type {
  ReportAltMetaDto,
  ReportAltUserSettingsDto,
} from '../../types/reportalt'
import {
  SETTINGS_URL_KEY,
  decodeSettings,
  encodeSettings,
  hasSettingsSupport,
  isEmptySettings,
  loadStoredSettings,
  saveStoredSettings,
  toUserSettingsDto,
  type ReportAltSettingsState,
} from '../utils/user-settings'

/**
 * Состояние пользовательских настроек отчёта ReportAlt (MVP — только клиент,
 * settings-design F-S1): черновик панели инициализируется из URL (`us`),
 * иначе — из localStorage (личный дефолт); применённая дельта уходит в тело
 * `/run` полем `userSettings`. Приоритет: URL > localStorage > вариант.
 */
export const useReportAltUserSettings = (
  code: string,
  meta: ReportAltMetaDto | null,
  searchParams: URLSearchParams
) => {
  // Черновик панели (что пользователь правит до «Применить»/«Сформировать»).
  const [draft, setDraft] = useState<ReportAltSettingsState | null>(null)

  // Инициализация черновика из URL (или личного дефолта localStorage) при
  // загрузке meta и перемонтировании вкладки — как черновики параметров.
  useEffect(() => {
    if (!meta) return
    const raw = searchParams.get(SETTINGS_URL_KEY)
    const fromUrl = raw != null ? decodeSettings(raw) : null
    // Сознательная синхронизация черновика из URL/meta при их смене.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(fromUrl ?? loadStoredSettings(code))
  }, [meta, searchParams, code])

  const supportsSettings = useMemo(() => hasSettingsSupport(meta), [meta])

  // Применённая дельта — производная от URL; при отсутствии `us` действует
  // личный дефолт из localStorage (URL приоритетнее, settings-design §7).
  const appliedUserSettings = useMemo<
    ReportAltUserSettingsDto | undefined
  >(() => {
    if (!meta || !supportsSettings) return undefined
    const raw = searchParams.get(SETTINGS_URL_KEY)
    const state = raw != null ? decodeSettings(raw) : loadStoredSettings(code)
    if (state == null || isEmptySettings(state)) return undefined
    // Каталог колонок — для решения, доливает ли что-то AUTO-маркер (иначе
    // он опускается, чтобы сервер не вернул скрытые use=false колонки).
    const availableColumnCodes = (meta.availableFields ?? [])
      .filter((f) => f.availableAsColumn === true)
      .map((f) => f.code)
    return toUserSettingsDto(
      state,
      meta.definition.schemaVersion,
      availableColumnCodes
    )
  }, [meta, supportsSettings, searchParams, code])

  // Сериализованный черновик для записи в URL (null = пустая дельта).
  const encodedDraft = useMemo(
    () =>
      draft != null && !isEmptySettings(draft) ? encodeSettings(draft) : null,
    [draft]
  )

  /** Сохраняет черновик личным дефолтом (localStorage) при применении. */
  const persistDraft = () => {
    saveStoredSettings(code, draft)
  }

  return {
    supportsSettings,
    draft,
    setDraft,
    appliedUserSettings,
    encodedDraft,
    persistDraft,
  }
}

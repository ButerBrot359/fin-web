import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Switch, Typography } from '@mui/material'

import { comparisonLabel } from '@/features/report-settings'

import type { ReportParameterDto } from '../types/report'
import { ReportParamField, type ReportParamValue } from './report-param-field'

/** Тёмно-зелёный 1С для заголовков разделов (как в живом СКД). */
const GREEN_1C = 'rgb(0,63,47)'

/** Локализованный заголовок параметра. */
const paramLabel = (p: ReportParameterDto, isKz: boolean): string =>
  (isKz ? p.titleKz : p.titleRu) || p.titleRu

/** Параметр языка формы — рендерим переключателем рус/каз (сейчас boolean). */
const isLanguageParam = (p: ReportParameterDto): boolean =>
  /yazyk/i.test(p.code)

/** Задано ли значение фильтра (для чекбокса активности отбора). */
const hasValue = (v: ReportParamValue): boolean =>
  v != null && v !== '' && !(Array.isArray(v) && v.length === 0)

/** Пустое значение по типу параметра (сброс отбора). */
const emptyValue = (p: ReportParameterDto): ReportParamValue =>
  p.dataType === 'REF_LIST' || p.dataType === 'ACCOUNT_LIST' ? [] : ''

interface MemorialOrderSettingsPanelProps {
  /** Параметры-флажки блока «Детализация». */
  detailParams: ReportParameterDto[]
  /** Параметры-отборы блока «Отборы» (справочные, сравнение EQUAL). */
  filterParams: ReportParameterDto[]
  values: Record<string, ReportParamValue>
  setParamValue: (code: string, v: ReportParamValue) => void
  isKz: boolean
  /** Чекбокс «Скрывать настройки при формировании отчёта». */
  hideOnSubmit: boolean
  onHideOnSubmitChange: (v: boolean) => void
}

/** Заголовок раздела 1С: жирный тёмно-зелёный. */
const SectionTitle = ({ children }: { children: ReactNode }) => (
  <Typography
    variant="subtitle2"
    sx={{ color: GREEN_1C, fontWeight: 700, mt: 1 }}
  >
    {children}
  </Typography>
)

/**
 * Панель «Настройки» бланка-мемориального ордера (МО-13 / Форма 396) — как в 1С:
 * два раздела. «Детализация» — параметры-флажки (язык формы — переключатель
 * рус/каз). «Отборы» — таблица «Поле | Тип сравнения | Список» со сравнением
 * «Равно»: строка с чекбоксом активности, полем и выбором значения из справочника
 * по referenceDomain. Панель раскладывает присланные с бэка параметры/отборы
 * (SDUI), логики не добавляет; пустой отбор в тело /run не уходит (пустое
 * значение не сериализуется).
 */
export const MemorialOrderSettingsPanel = ({
  detailParams,
  filterParams,
  values,
  setParamValue,
  isKz,
  hideOnSubmit,
  onHideOnSubmitChange,
}: MemorialOrderSettingsPanelProps) => {
  const { t } = useTranslation()

  return (
    <div className="w-[360px] shrink-0 rounded-md border border-ui-04 bg-white">
      <div className="flex flex-col gap-2 p-3">
        {/* ── Детализация ──────────────────────────────────────────── */}
        {detailParams.length > 0 && (
          <>
            <SectionTitle>{t('reports.detailSection')}</SectionTitle>
            <div className="flex flex-col">
              {detailParams.map((p) => {
                const checked = values[p.code] === true
                const onToggle = (v: boolean) => {
                  setParamValue(p.code, v)
                }
                return isLanguageParam(p) ? (
                  <FormControlLabel
                    key={p.code}
                    control={
                      <Switch
                        size="small"
                        checked={checked}
                        onChange={(e) => {
                          onToggle(e.target.checked)
                        }}
                      />
                    }
                    label={t('reports.russianLanguage')}
                  />
                ) : (
                  <FormControlLabel
                    key={p.code}
                    control={
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={(e) => {
                          onToggle(e.target.checked)
                        }}
                      />
                    }
                    label={paramLabel(p, isKz)}
                  />
                )
              })}
            </div>
          </>
        )}

        {/* ── Отборы (Поле | Тип сравнения | Список, сравнение «Равно») ── */}
        {filterParams.length > 0 && (
          <>
            <SectionTitle>{t('reports.filtersSection')}</SectionTitle>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-ui-04 text-left">
                  <th className="w-6 px-1 py-1" />
                  <th className="px-1 py-1">
                    <Typography variant="caption" className="text-ui-05">
                      {t('reportSettings.field')}
                    </Typography>
                  </th>
                  <th className="px-1 py-1">
                    <Typography variant="caption" className="text-ui-05">
                      {t('reportSettings.comparison')}
                    </Typography>
                  </th>
                  <th className="px-1 py-1">
                    <Typography variant="caption" className="text-ui-05">
                      {t('reportSettings.value')}
                    </Typography>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filterParams.map((p) => {
                  const active = hasValue(values[p.code])
                  return (
                    <tr key={p.code} className="align-top">
                      <td className="px-1 py-1">
                        <Checkbox
                          size="small"
                          checked={active}
                          // Активность отбора привязана к значению: снятие
                          // галочки очищает отбор (в /run он не уйдёт).
                          onChange={() => {
                            if (active) setParamValue(p.code, emptyValue(p))
                          }}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Typography variant="body2" className="text-ui-06">
                          {paramLabel(p, isKz)}
                        </Typography>
                      </td>
                      <td className="px-1 py-2">
                        <Typography variant="body2" className="text-ui-06">
                          {comparisonLabel('EQUAL', isKz)}
                        </Typography>
                      </td>
                      <td className="px-1 py-1">
                        <ReportParamField
                          param={{ ...p, titleRu: '', titleKz: '' }}
                          value={values[p.code]}
                          onChange={(v) => {
                            setParamValue(p.code, v)
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Скрывать панель после «Сформировать». */}
        <FormControlLabel
          className="mt-2"
          control={
            <Checkbox
              size="small"
              checked={hideOnSubmit}
              onChange={(e) => {
                onHideOnSubmitChange(e.target.checked)
              }}
            />
          }
          label={
            <Typography variant="body2">
              {t('reports.hideSettingsOnSubmit')}
            </Typography>
          }
        />
      </div>
    </div>
  )
}

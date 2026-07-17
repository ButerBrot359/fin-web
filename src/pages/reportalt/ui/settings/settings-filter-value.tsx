import type {
  ReportAltFilterFieldDto,
  ReportAltParameterDto,
  ReportAltParameterType,
} from '../../types/reportalt'
import type { ReportAltParamValue } from '../../lib/utils/params'
import type { SettingsFilterValue as FilterValue } from '../../lib/utils/user-settings'
import { comparisonIsMulti } from '../../lib/utils/user-settings'
import { ReportAltParamField } from '../reportalt-param-field'

/** Известные типы значения (`ReportAltParameterType`) — фолбэк STRING. */
const KNOWN_TYPES = new Set<string>([
  'DATE',
  'PERIOD',
  'ACCOUNT_LIST',
  'ACCOUNT_REF',
  'DICTIONARY_REF',
  'ENUM_REF',
  'REF_LIST',
  'BOOLEAN',
  'STRING',
  'NUMBER',
])

/** Тип редактора: PERIOD → DATE; мультисравнение поднимает REF до списка. */
const resolveDataType = (
  valueType: string | undefined,
  multi: boolean
): ReportAltParameterType => {
  const base: ReportAltParameterType =
    valueType != null && KNOWN_TYPES.has(valueType)
      ? (valueType as ReportAltParameterType)
      : 'STRING'
  if (base === 'PERIOD') return 'DATE'
  if (!multi) return base
  if (base === 'DICTIONARY_REF' || base === 'ENUM_REF') return 'REF_LIST'
  if (base === 'ACCOUNT_REF') return 'ACCOUNT_LIST'
  return base
}

interface SettingsFilterValueProps {
  field: ReportAltFilterFieldDto
  comparison: string
  values: FilterValue[]
  onChange: (values: FilterValue[]) => void
  label: string
}

/**
 * Редактор значения строки отбора: переиспользует `ReportAltParamField`
 * (тот же выбор контрола по dataType, что у параметров отчёта), конвертируя
 * массив значений строки отбора в значение параметра и обратно.
 */
export const SettingsFilterValue = ({
  field,
  comparison,
  values,
  onChange,
  label,
}: SettingsFilterValueProps) => {
  const multi = comparisonIsMulti(comparison) || field.multi === true
  const dataType = resolveDataType(field.valueType, multi)
  const isList = dataType === 'ACCOUNT_LIST' || dataType === 'REF_LIST'

  const param: ReportAltParameterDto = {
    code: field.field,
    titleRu: label,
    titleKz: label,
    dataType,
    required: false,
    allowList: isList,
    referenceDomain: field.referenceDomain,
  }

  // values[] (модель строки отбора) → значение параметра по типу контрола.
  const paramValue: ReportAltParamValue = isList
    ? values.filter((v): v is number => typeof v === 'number')
    : dataType === 'BOOLEAN'
      ? values[0] === true
      : ((values[0] as string | number | undefined) ?? '')

  const handleChange = (v: ReportAltParamValue) => {
    if (Array.isArray(v)) {
      onChange(v)
      return
    }
    if (typeof v === 'boolean') {
      onChange([v])
      return
    }
    if (v == null || v === '' || typeof v === 'object') {
      onChange([])
      return
    }
    onChange([v])
  }

  return (
    <ReportAltParamField
      param={param}
      value={paramValue}
      onChange={handleChange}
    />
  )
}

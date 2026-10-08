import type { ParamValues, ReportAltParamValue } from '../../lib/utils/params'
import type { ReportAltParameterDto } from '../../types/reportalt'
import { ReportAltParamField } from '../reportalt-param-field'

interface SettingsParamsTabProps {
  params: ReportAltParameterDto[]
  paramValues: ParamValues
  onParamChange?: (code: string, value: ReportAltParamValue) => void
}

export const SettingsParamsTab = ({
  params,
  paramValues,
  onParamChange,
}: SettingsParamsTabProps) => (
  <div className="flex flex-col gap-3 pt-1">
    {params.map((param) => (
      <ReportAltParamField
        key={param.code}
        param={param}
        value={paramValues[param.code]}
        onChange={(v) => {
          onParamChange?.(param.code, v)
        }}
      />
    ))}
  </div>
)

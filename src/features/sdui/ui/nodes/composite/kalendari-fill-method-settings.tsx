import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useFieldNode } from '../../../lib/hooks/use-field-node'
import {
  resolveEnumValue,
  type EnumOption,
} from '../../../lib/utils/enum-value'
import { NodeRenderer } from '../../node-renderer'
import {
  CYCLIC_CODE,
  KalendariCycleLengthField,
} from './kalendari-cycle-length-field'

export const FILL_METHOD_SETTINGS_NODE_ID = 'kalendari.fillMethodSettings'

const MISSING_ENUM_NODE: ViewNode = {
  id: 'kalendari-fill-method-missing',
  type: 'ENUM_FIELD',
}

const findChild = (node: ViewNode, binding: string): ViewNode | undefined =>
  node.children?.find((c) => c.binding === binding)

/**
 * One-off композиция узла `kalendari.fillMethodSettings` (spec v4 §SDUI):
 * способ заполнения — радиогруппой (props.control="radio"), а в строке
 * циклической опции — длина цикла, текст «дней, начиная с:» и DataOtscheta
 * без собственного лейбла. Отправка значения — обычный field change EVENT,
 * как у EnumFieldNode.
 */
export const KalendariFillMethodSettings: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const enumNode = findChild(node, 'SposobZapolneniya')
  const dateNode = findChild(node, 'DataOtscheta')
  const f = useFieldNode(enumNode ?? MISSING_ENUM_NODE)

  // Контракт не совпал (нет радио-поля) — узел рендерится как обычный HSTACK
  // на уровне вызова; сюда попадать не должен, но защитно отдаём детей как есть
  if (!enumNode) {
    return (
      <div className="flex gap-2">
        {node.children?.map((c) => (
          <NodeRenderer key={c.id} node={c} />
        ))}
      </div>
    )
  }

  const options = (enumNode.props?.options as EnumOption[] | undefined) ?? []
  const value = resolveEnumValue(f.value, options)
  const cyclicSelected =
    options.find((o) => o.value === value)?.code === CYCLIC_CODE ||
    value === CYCLIC_CODE

  if (!f.visible) return null

  const selectOption = (opt: EnumOption) => {
    const enumValue = {
      id: opt.id ?? opt.value,
      code: opt.code ?? opt.value,
      presentation: opt.label,
    }
    f.setValue(enumValue)
    f.fireServerEvent('change', enumValue)
  }

  return (
    <FormControl disabled={!f.enabled} sx={{ width: '100%' }}>
      {f.label && (
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {f.label}
        </Typography>
      )}
      <RadioGroup value={value}>
        {options.map((opt) => {
          const isCyclic = (opt.code ?? opt.value) === CYCLIC_CODE
          const radio = (
            <FormControlLabel
              key={opt.value}
              value={opt.value}
              control={<Radio size="small" />}
              label={opt.label}
              disabled={!f.enabled || f.readonly}
              onChange={() => {
                if (value !== opt.value) selectOption(opt)
              }}
            />
          )
          if (!isCyclic) return radio
          // Строка циклической опции: радио + длина цикла + «дней, начиная с:»
          // + дата отсчёта в одной горизонтали (1С-эталон, spec v4)
          return (
            <div key={opt.value} className="flex items-center gap-2 flex-wrap">
              {radio}
              <KalendariCycleLengthField disabled={!cyclicSelected} />
              <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                {t('sdui.kalendari.daysStartingFrom')}
              </Typography>
              {dateNode && (
                <div style={{ width: 170 }}>
                  <NodeRenderer
                    node={{
                      ...dateNode,
                      props: { ...dateNode.props, label: undefined },
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </RadioGroup>
    </FormControl>
  )
}

import { isListOp, isRangeOp } from './value-controls.utils'
import type { ValueControlProps } from './value-controls-primitives'
import {
  BooleanControl,
  DateControl,
  DateRangeControl,
  NumberControl,
  NumberRangeControl,
  StringControl,
  StringListControl,
} from './value-controls-primitives'
import { DictionaryControl, EnumsControl } from './value-controls-reference'

export const ValueControl = (props: ValueControlProps) => {
  const { op, column } = props

  if (op === 'isNull' || op === 'isNotNull') return null

  const isRange = isRangeOp(op)
  const isList = isListOp(op)

  switch (column.dataType) {
    case 'STRING':
    case 'TEXT':
      return isList ? (
        <StringListControl {...props} />
      ) : (
        <StringControl {...props} />
      )

    case 'INTEGER':
    case 'DECIMAL':
      if (isRange) return <NumberRangeControl {...props} />
      if (isList) return <StringListControl {...props} />
      return <NumberControl {...props} />

    case 'DATE':
    case 'DATETIME':
      return isRange ? (
        <DateRangeControl {...props} />
      ) : (
        <DateControl {...props} />
      )

    case 'BOOLEAN':
      return <BooleanControl {...props} />

    case 'DICTIONARY':
    case 'DOCUMENT':
    case 'ACCOUNT_PLAN':
    case 'CHARACTERISTICS_PLAN':
    case 'EXCHANGE_PLAN':
    case 'CALCULATION_PLAN':
      // Reference без resolved typeCode (gap бэка):
      //   - DICTIONARY self-FK обычно патчится page-level (см. dictionary-page),
      //     сюда попадает только если страница не залатала.
      //   - DOCUMENT регистров (`recorderDocumentEntryId`) — universal picker
      //     ещё не реализован.
      // TODO(phase-3-frontend): универсальный document-picker для reference
      // полей с domainKind=DOCUMENT без typeCode. Сейчас используется NumberInput.
      if (!column.referencedTypeCode) {
        if (isRange) return <NumberRangeControl {...props} />
        if (isList) return <StringListControl {...props} />
        return <NumberControl {...props} />
      }
      return <DictionaryControl {...props} />

    case 'ENUMS':
      return <EnumsControl {...props} />

    default:
      return null
  }
}

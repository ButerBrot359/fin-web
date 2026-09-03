import type { FC, ReactNode } from 'react'
import { useState } from 'react'
import { Checkbox, MenuItem, Select } from '@mui/material'

import { TextInput, NumberInput } from '@/shared/ui/inputs'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'
import { renderCellValue } from '../../../lib/utils/cell-value'
import { isCellEmpty } from '../../../lib/utils/is-cell-empty'
import {
  allowsDecimalInput,
  numberPrecision,
} from '../../../lib/utils/number-input-mode'
import {
  resolveEnumValue,
  type EnumOption,
} from '../../../lib/utils/enum-value'
import { ReferenceCellEditor } from './reference-cell-editor'
import { DateCellEditor } from './date-cell-editor'
import { ObjectCellEditor } from './object-cell-editor'
import {
  cellSx,
  enumCellSx,
  nowrapEnumCellSx,
  dateCellSx,
  readonlyCellTextStyle,
  nowrapCellTextStyle,
} from './table-cell-editor-styles'
import { RequiredCellFrame } from './required-cell-frame'

interface TableCellEditorProps {
  cellWidget: string
  dataType: string
  value: unknown
  readonly?: boolean
  required?: boolean
  /**
   * Колонка исключена из переноса текста (см. `isNoWrapColumn`): значение
   * держится в одну строку и обрезается многоточием.
   */
  noWrap?: boolean
  revealErrors?: boolean
  props?: Record<string, unknown>
  onChange: (value: unknown) => void
  onCommit: () => void
  extraParams?: Record<string, string>
  /**
   * SCRUM-363: binding колонки — DOM-якорь `data-sdui-cell-binding`, по нему
   * автопереход находит ячейку строго внутри своей таблицы.
   */
  binding?: string
  /**
   * SCRUM-363: ячейка — одноразовая цель автофокуса; ссылочный редактор
   * раскрывает список на фокусе. Обычный клик пользователя поведения не меняет.
   */
  autoOpen?: boolean
  /**
   * ADR-0029 Phase 2b: server-driven аффордансы пикера ячейки. Пробрасываются в
   * `ReferenceCellEditor`; `undefined` ⇒ там сработает легаси-пикер (двойной путь).
   */
  onServerShowAll?: () => void
  onServerCreate?: () => void
}

/**
 * `unknown` → строка для показа. Явный разбор примитивов вместо `String(value)`:
 * на объекте `String()` дал бы «[object Object]» (правило no-base-to-string), а
 * ссылочные значения `{id, presentation}` умеет разворачивать renderCellValue.
 */
function toDisplayString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  return renderCellValue(value)
}

function formatReadonlyValue(
  value: unknown,
  dataType: string,
  dateFormat?: string
): string {
  if (value == null || value === '') return ''
  // Ссылочные/enum значения {id, presentation} — показываем presentation
  if (typeof value === 'object' && 'presentation' in value) {
    return renderCellValue(value)
  }
  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return toDisplayString(value)
    case 'INTEGER':
    case 'DECIMAL':
      return formatWithSpaces(toDisplayString(value))
    // Формат колонки действует и здесь: у readonly-ячейки «Месяца начисления»
    // нет редактора, но показывать в ней день так же неверно.
    case 'DATE':
      return typeof value === 'string' ? formatDate(value, dateFormat) : ''
    case 'DATETIME':
      if (typeof value !== 'string') return ''
      return dateFormat ? formatDate(value, dateFormat) : formatDateTime(value)
    case 'BOOLEAN':
      // Явное сравнение, а не проверка на «истинность» unknown: у BOOLEAN-колонки
      // на проводе приезжает boolean (или его строковая форма), а для unknown
      // no-unnecessary-condition считает любое значение истинным.
      return value === true || value === 'true' ? '✓' : ''
    default:
      return renderCellValue(value)
  }
}

export const TableCellEditor: FC<TableCellEditorProps> = ({
  cellWidget,
  dataType,
  value,
  readonly,
  required,
  noWrap,
  revealErrors,
  props,
  onChange,
  onCommit,
  extraParams,
  binding,
  autoOpen,
  onServerShowAll,
  onServerCreate,
}) => {
  const [touched, setTouched] = useState(false)
  const handleCommit = () => {
    setTouched(true)
    onCommit()
  }
  const dateFormat = props?.dateFormat as string | undefined

  const textStyle = noWrap ? nowrapCellTextStyle : readonlyCellTextStyle

  // SCRUM-363: стабильный DOM-якорь ячейки для автоперехода. Ставится и на
  // readonly-ячейку — искатель обязан находить её, чтобы корректно пропустить.
  const anchored = (content: ReactNode): ReactNode =>
    binding ? (
      <span data-sdui-cell-binding={binding} style={{ display: 'block' }}>
        {content}
      </span>
    ) : (
      content
    )

  if (readonly) {
    return (
      // Перенос текста по ширине колонки — общий стиль всех ячеек без
      // редактора (readonlyCellTextStyle); в исключённой колонке — одна строка.
      // Якорь binding — прямо на этом span (без обёртки): лишний уровень ломал
      // бы поиск стилизованного узла по textContent в тестах и утилитах.
      <span data-sdui-cell-binding={binding} style={textStyle}>
        {formatReadonlyValue(value, dataType, dateFormat)}
      </span>
    )
  }

  const renderWidget = (): ReactNode => {
    switch (cellWidget) {
      case 'TEXT_FIELD': {
        const strValue = toDisplayString(value)
        return (
          <TextInput
            value={strValue}
            // multiline — тот же перенос, что у readonly-значения: ширина
            // колонки фиксирована, и <input> длинный текст прокручивает вместо
            // переноса. В исключённой колонке перенос не нужен, поэтому там
            // остаётся однострочный <input>. Enter по-прежнему КОММИТИТ ячейку,
            // а не добавляет строку, поэтому событие гасится.
            multiline={!noWrap}
            onChange={(e) => {
              onChange(e.target.value)
            }}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCommit()
              }
            }}
            size="small"
            sx={cellSx}
          />
        )
      }

      case 'NUMBER_FIELD': {
        const strValue = toDisplayString(value)
        return (
          <NumberInput
            value={strValue}
            // Дробная часть — по props.precision колонки, а dataType лишь
            // фолбэк: колонки «Размер»/«Ставка» в эталоне 1С дробные.
            decimal={allowsDecimalInput(props, dataType)}
            precision={numberPrecision(props)}
            onChange={(e) => {
              const raw = e.target.value
              const parsed = raw === '' ? null : parseFloat(raw)
              onChange(parsed)
            }}
            onBlur={handleCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit()
            }}
            size="small"
            sx={cellSx}
          />
        )
      }

      case 'DATE_FIELD':
      case 'DATETIME_FIELD':
        // Коммит НЕ на onChange: пикер стреляет на каждый сегмент даты, и коммит
        // посреди набора перемонтировал ячейку — терялись цифры года (SCRUM-279 D6).
        // Подробный разбор и ловушки фокуса — в date-cell-editor.tsx.
        return (
          <DateCellEditor
            value={value}
            dateOnly={cellWidget === 'DATE_FIELD'}
            dateFormat={dateFormat}
            sx={dateCellSx}
            onChange={onChange}
            onCommit={handleCommit}
          />
        )

      case 'CHECKBOX_FIELD': {
        return (
          <Checkbox
            checked={!!value}
            onChange={(e) => {
              onChange(e.target.checked)
              handleCommit()
            }}
            size="small"
            sx={{ p: '2px' }}
          />
        )
      }

      case 'ENUM_FIELD': {
        const options = (props?.options as EnumOption[] | undefined) ?? []
        const current = resolveEnumValue(value, options)
        return (
          <Select
            value={current}
            onChange={(e) => {
              const selected = e.target.value
              const opt = options.find((o) => o.value === selected)
              // Тот же контракт значения, что в enum-field-node.tsx
              onChange(
                opt
                  ? {
                      id: opt.id ?? selected,
                      code: opt.code ?? opt.value,
                      presentation: opt.label,
                    }
                  : { id: selected, code: selected, presentation: selected }
              )
              handleCommit()
            }}
            size="small"
            fullWidth
            variant="standard"
            sx={noWrap ? nowrapEnumCellSx : enumCellSx}
          >
            {options.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        )
      }

      case 'REFERENCE_FIELD':
        return (
          <ReferenceCellEditor
            colProps={props ?? {}}
            value={value}
            onChange={onChange}
            onCommit={handleCommit}
            extraParams={extraParams}
            noWrap={noWrap}
            openOnFocus={autoOpen}
            onServerShowAll={onServerShowAll}
            onServerCreate={onServerCreate}
          />
        )

      // Составной (OBJECT) тип: селектор члена + пикер значения. Без этой ветки
      // ячейка падала в `default:` и была нередактируемой — жалоба аналитика
      // «„Значение“ в доп.реквизитах не активно» (SCRUM-279).
      case 'OBJECT_FIELD':
        return (
          <ObjectCellEditor
            colProps={props ?? {}}
            value={value}
            onChange={onChange}
            onCommit={handleCommit}
          />
        )

      default:
        // Неизвестный виджет — показываем значение текстом; перенос тот же, что
        // у readonly-ячейки, иначе последняя ветка редактора осталась бы
        // единственной, где длинное значение вылезает за колонку.
        return <span style={textStyle}>{renderCellValue(value)}</span>
    }
  }

  const inner = renderWidget()
  if (!required) return anchored(inner)

  const showError =
    isCellEmpty(value, cellWidget) && (touched || !!revealErrors)
  return anchored(
    <RequiredCellFrame show={showError}>{inner}</RequiredCellFrame>
  )
}

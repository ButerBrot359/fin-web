import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { cssVar, palette } from '@/shared/design/tokens'

import type {
  ReportColumnDto,
  ReportFieldRole,
  ReportFormDto,
  ReportFormSectionDto,
} from '@/pages/reports/report-list/types/report'

import {
  formatMoney1C,
  isHighlightRow,
  isRightAligned,
  resolveReportLang,
} from '../lib/cell-helpers'
import { buildHeadModel } from '../lib/head-model'
import { ReportCell } from './report-cell'

/**
 * Сетка бланка 1С: чёткая серая рамка каждой ячейки (официальная форма
 * печатается с выраженной сеткой, темнее аналитических отчётов), плотные ячейки.
 */
const td = 'border border-pending-gray-6 px-1.5 py-0.5 align-top'
const th = 'border border-pending-gray-6 px-1.5 py-1 text-center align-middle'

/** Ширина одного символа колонки (`width` приходит в символах, как в 1С). */
const CHAR_PX = 8

/** Колонка бланка, у которой `role`/`width` могут прийти пустыми (бэк форм-контура). */
type LooseColumn = Omit<ReportColumnDto, 'role'> & {
  role: ReportFieldRole | null
}

/** Код/титул колонки — порядковый номер (№ п/п): не деньги, узкая графа. */
const ORDINAL_RE = /№|п\/п|nomerpp|(^|_)nomer|номер/i
/** ISO-дата в ячейке (`yyyy-MM-dd…`) — колонку форматируем как дату. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/

/** Является ли значение числом (или числовой строкой). */
const isNumericValue = (v: unknown): boolean =>
  typeof v === 'number' ||
  (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))

/** Непустые значения ячеек колонки по всем строкам секции. */
const columnValues = (
  section: ReportFormSectionDto,
  code: string
): unknown[] => {
  const out: unknown[] = []
  for (const row of section.rows) {
    const v = row.cells[code]
    if (v != null && v !== '') out.push(v)
  }
  return out
}

/**
 * Бэк form-контура присылает колонки без `role`/`width` (только `align`,
 * `groupTitle`…). Без роли рендерер не форматирует числа (сырое
 * «9541679183.35») и не выравнивает деньги; без ширины 15–20 граф схлопываются
 * в ~40px и цифры наезжают друг на друга. Достраиваем эффективные `role`/`width`
 * по данным колонки: числовые → MEASURE (1С-деньги, пусто на нуле), даты →
 * PERIOD, №п/п — как есть узкой графой; ширину числовых считаем по самому
 * длинному значению (не обрезаемся и не растягиваем зря). Колонки, где бэк уже
 * задал role и width, не трогаем.
 */
const deriveFormColumns = (section: ReportFormSectionDto): ReportColumnDto[] =>
  section.columns.map((col) => {
    const loose = col as LooseColumn
    if (loose.role != null && loose.width != null) return col

    const values = columnValues(section, col.code)
    const isOrdinal = ORDINAL_RE.test(col.code) || ORDINAL_RE.test(col.titleRu)
    const allNumeric = values.length > 0 && values.every(isNumericValue)
    const allDate =
      values.length > 0 &&
      values.every((v) => typeof v === 'string' && ISO_DATE_RE.test(v))

    const patch: Partial<ReportColumnDto> = {}

    // Эффективная роль (когда бэк её не прислал): дата → PERIOD, число → MEASURE.
    // Деньги отличаем от идентификаторов (код счёта «1010», №п/п) по `align`:
    // 1С выравнивает суммы вправо, а коды/наименования — влево. Так код счёта
    // (число-строка, но align=LEFT) не превращается в «1 010,00».
    let role: ReportFieldRole | null = loose.role
    if (role == null) {
      if (allDate) role = 'PERIOD'
      else if (allNumeric && !isOrdinal && col.align === 'RIGHT')
        role = 'MEASURE'
      if (role != null) patch.role = role
      // Матрица накопительной ведомости 1С печатает нули пустыми клетками.
      if (role === 'MEASURE') patch.blankOnZero = true
    }

    // Эффективная ширина (символы ≈ ×8px), если бэк её не задал.
    if (loose.width == null) {
      if (role === 'MEASURE') {
        // По самому длинному 1С-числу колонки: не обрезаемся, не растягиваем зря.
        const maxLen = values.reduce<number>((mx, v) => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isNaN(n) ? mx : Math.max(mx, formatMoney1C(n).length)
        }, 0)
        patch.width = Math.min(22, Math.max(9, maxLen + 1))
      } else if (role === 'PERIOD') patch.width = 11
      else if (isOrdinal) patch.width = 5
      else {
        // Описательная (Счёт/Наименование/Документ) — по длине заголовка/значений.
        const textLen = values.reduce<number>(
          (mx, v) => Math.max(mx, String(v).length),
          col.titleRu.length
        )
        patch.width = Math.min(26, Math.max(8, textLen + 2))
      }
    }

    return Object.keys(patch).length > 0 ? { ...col, ...patch } : col
  })

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/** Ячейка шапки: заголовок + объединения. */
interface HeadCell {
  key: string
  title: string
  colSpan: number
  rowSpan: number
  /** Средний ряд — номер счёта-подгруппы (1С печатает его жирным курсивом). */
  emphasis?: boolean
}

/**
 * Ряды многоуровневой шапки бланка — generic для 1/2/3 рядов по наличию
 * `groupTitleRu`/`subGroupTitleRu` (SDUI: рисуем присланное, без хардкода).
 * Модель строит общий {@link buildHeadModel} (глубина 'auto', ключи 'g-'/'s-',
 * подгруппы с emphasis — жирный курсив 1С); листья разложены в нижний ряд.
 */
const buildHeadRows = (
  cols: ReportColumnDto[],
  isKz: boolean
): HeadCell[][] | null => {
  const model = buildHeadModel(cols, {
    isKz,
    levels: 'auto',
    groupKeyPrefix: 'g-',
    subKeyPrefix: 's-',
    subEmphasis: true,
  })
  if (model.levels === 1) return null
  // Нижний ряд: листовые колонки как обычные ячейки 1×1.
  const leafCells: HeadCell[] = model.leafRow.map(({ key, col }) => ({
    key,
    title: columnTitle(col, isKz),
    colSpan: 1,
    rowSpan: 1,
  }))
  return model.levels === 3
    ? [model.topRow, model.midRow, leafCells]
    : [model.topRow, leafCells]
}

/**
 * Таблица одной секции бланка (дебет/кредит субсчёта): многоуровневая шапка
 * (группы/подгруппы/листья), строка сквозной нумерации граф (как в 1С:
 * 1..13, 14..26), DATA-строки и жирная строка «Итого:».
 */
const SectionTable = ({
  section,
  isKz,
}: {
  section: ReportFormSectionDto
  isKz: boolean
}) => {
  const cols = deriveFormColumns(section)
  const start = section.graphNumberStart ?? 1
  const headRows = buildHeadRows(cols, isKz)
  return (
    <table className="w-full table-fixed border-collapse bg-white">
      <colgroup>
        {cols.map((c, i) => (
          <col
            key={c.code}
            style={{
              // Ширина колонки: приоритет — `column.width` с бэка (в символах ×8px).
              // Иначе — role-aware дефолт под 1С: №пп узкая; числовые (субсчета/
              // Итого/суммы) компактные (не растягиваются, как было при auto);
              // дата — умеренная; описательные (наименование/МОЛ) — широкие;
              // DIMENSION — авто.
              width:
                c.width != null
                  ? c.width * CHAR_PX
                  : i === 0
                    ? 40
                    : c.role === 'MEASURE'
                      ? 104
                      : c.role === 'PERIOD'
                        ? 96
                        : c.role === 'ATTRIBUTE'
                          ? 150
                          : undefined,
            }}
          />
        ))}
      </colgroup>
      <thead>
        {headRows ? (
          headRows.map((cells, ri) => (
            <tr key={ri}>
              {cells.map((cell) => (
                <th
                  key={cell.key}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  className={th}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: cssVar(palette.pendingText1),
                      fontWeight: cell.emphasis ? 700 : undefined,
                      fontStyle: cell.emphasis ? 'italic' : undefined,
                      // Многострочные заголовки граф (напр. «Д»/«К» блока «Вторые
                      // записи» ф438: «Д» над «К» в одной графе) — переносим по '\n'.
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {cell.title}
                  </Typography>
                </th>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            {cols.map((col) => (
              <th key={col.code} className={th}>
                <Typography
                  variant="caption"
                  sx={{ color: cssVar(palette.pendingText1) }}
                >
                  {columnTitle(col, isKz)}
                </Typography>
              </th>
            ))}
          </tr>
        )}
        {section.numberGraphs && (
          <tr>
            {cols.map((col, i) => (
              <th key={col.code} className={`${th} py-0`}>
                <Typography
                  variant="caption"
                  sx={{ color: cssVar(palette.pendingText1) }}
                >
                  {start + i}
                </Typography>
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {section.rows.map((row, idx) => {
          const highlight = isHighlightRow(row.rowKind)
          // Подпись «Всего»/«Барлығы» объединяется по первым `labelColSpan`
          // колонкам (№пп|Дата|Номер|Наименование), как в 1С — иначе метка сидит
          // в одной графе, а не растянута по описательным колонкам.
          const labelSpan =
            highlight && row.labelText
              ? Math.min(row.labelColSpan ?? 1, cols.length)
              : 0
          return (
            <tr key={idx}>
              {cols.map((col, ci) => {
                // Ячейки, поглощённые colSpan подписи, не рендерим.
                if (labelSpan > 1 && ci > 0 && ci < labelSpan) return null
                if (labelSpan > 0 && ci === 0) {
                  return (
                    <td
                      key={col.code}
                      colSpan={labelSpan}
                      className={`${td} text-right`}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: cssVar(palette.pendingText1),
                          fontWeight: 700,
                        }}
                      >
                        {row.labelText}
                      </Typography>
                    </td>
                  )
                }
                return (
                  <td
                    key={col.code}
                    className={`${td} ${isRightAligned(col) ? 'text-right' : ci === 0 ? 'text-center' : ''}`}
                  >
                    <ReportCell
                      value={row.cells[col.code]}
                      col={col}
                      bold={highlight}
                    />
                  </td>
                )
              })}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Официальный бланк отчёта (мемориальный ордер) — 1 в 1 с печатной формой 1С:
 * правовой гриф и номер формы, организация, заголовок «№ N Мемориальный
 * ордер», период, название накопительной ведомости, секции дебета/кредита
 * субсчёта с графами-кор.счетами и сквозной нумерацией, остатки на
 * начало/конец месяца и подписи.
 */
export const FormView = ({
  form,
  language,
}: {
  form: ReportFormDto
  language?: string
}) => {
  const { i18n } = useTranslation()
  // Язык бланка — по языку отчёта (может отличаться от языка UI), фолбэк на UI.
  const isKz = resolveReportLang(language, i18n.language) === 'kz'

  return (
    <div className="flex w-full flex-col gap-1 bg-white text-pending-text-1">
      {/* Гриф и номер формы. */}
      <div className="flex items-start justify-between">
        <div>
          {form.legalHeader?.map((line, i) => (
            <Typography
              key={i}
              variant="caption"
              component="div"
              sx={{ color: cssVar(palette.pendingText1) }}
            >
              {line}
            </Typography>
          ))}
        </div>
        {form.formNumber && (
          <Typography
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
          >
            {form.formNumber}
          </Typography>
        )}
      </div>

      {/* Организация с подписью поля. */}
      {form.organizationLine && (
        <div className="mt-2">
          <Typography
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1) }}
            className="border-b border-pending-text-1 inline-block pr-24"
          >
            {form.organizationLine}
          </Typography>
          {form.organizationCaption && (
            <Typography
              variant="caption"
              component="div"
              sx={{ color: cssVar(palette.pendingText2), fontSize: 10 }}
            >
              {form.organizationCaption}
            </Typography>
          )}
        </div>
      )}

      {/* Заголовок бланка. */}
      <div className="mt-3 text-center">
        {form.title && (
          <Typography
            variant="body1"
            sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
          >
            {form.title}
          </Typography>
        )}
        {form.periodLine && (
          <Typography
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
          >
            {form.periodLine}
          </Typography>
        )}
        {form.vedomostTitle && (
          <Typography
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
          >
            {form.vedomostTitle}
          </Typography>
        )}
        {/* Список счетов в заголовок не выводим (эталон 1С: счета — параметр
            «Список счетов» и примечание-Ескерту, не часть названия формы). */}
      </div>

      {/* Секции (дебет/кредит субсчёта). */}
      {form.sections.map((section, i) => (
        <div key={i} className="mt-3 flex flex-col gap-1">
          {section.title && (
            <Typography
              variant="body2"
              sx={{ color: cssVar(palette.pendingText1) }}
            >
              {section.title}
            </Typography>
          )}
          {section.openingLine && (
            <Typography
              variant="body2"
              sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
            >
              {section.openingLine}
            </Typography>
          )}
          {/* Горизонтальный скролл: широкий бланк (много граф-субсчетов) не
              обрезается и не ломает страницу; на печати разворачивается целиком. */}
          <div className="overflow-x-auto">
            <SectionTable section={section} isKz={isKz} />
          </div>
        </div>
      ))}

      {/* Остатки на конец и подписи. */}
      <div className="mt-2 flex flex-col gap-1">
        {form.footerLines?.map((line, i) => (
          <Typography
            key={i}
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1), fontWeight: 700 }}
          >
            {line}
          </Typography>
        ))}
      </div>

      {form.signatures && form.signatures.length > 0 && (
        <div className="mt-6 flex flex-col gap-6">
          {form.signatures.map((sig, i) => (
            <div key={i} className="flex items-end gap-6">
              <Typography
                variant="body2"
                sx={{ color: cssVar(palette.pendingText1) }}
                className="w-44 shrink-0"
              >
                {sig.role}
              </Typography>
              {(sig.captions ?? ['подпись']).map((caption, ci) => (
                <div key={ci} className="flex w-48 flex-col items-center">
                  <Typography
                    variant="body2"
                    sx={{ color: cssVar(palette.pendingText1) }}
                    className="min-h-5"
                  >
                    {ci === (sig.captions?.length ?? 1) - 1
                      ? (sig.name ?? '')
                      : ''}
                  </Typography>
                  <div className="w-full border-t border-pending-text-1" />
                  <Typography
                    variant="caption"
                    sx={{ color: cssVar(palette.pendingText2), fontSize: 10 }}
                  >
                    {caption}
                  </Typography>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Обязательная строка бланка мем-ордера (1С): «Приложение ___ лист».
          Рендерим вместе с подписями (часть подвала), на языке отчёта. Метка-приставка
          «Приложение»/«Қосымшасы» — тем же шрифтом, что роли подписей («Орындаушы»/«Бас
          бухгалтер», body2); единица «лист»/«парақ» — мелким caption, как подписи-графы
          «(тегі, аты…)». */}
      {form.signatures && form.signatures.length > 0 && (
        <div className="mt-6 flex items-end gap-2">
          <Typography
            variant="body2"
            sx={{ color: cssVar(palette.pendingText1) }}
            className="w-44 shrink-0"
          >
            {isKz ? 'Қосымшасы' : 'Приложение'}
          </Typography>
          <div className="w-40 self-end border-t border-pending-text-1" />
          <Typography
            variant="caption"
            sx={{ color: cssVar(palette.pendingText2), fontSize: 10 }}
          >
            {isKz ? 'парақ' : 'лист'}
          </Typography>
        </div>
      )}

      {/* Примечание/памятка — ПОСЛЕ подписей (порядок 1С: подписи → памятка). */}
      {form.noteLines && form.noteLines.length > 0 && (
        <div className="mt-6 flex flex-col gap-1">
          {form.noteLines.map((line, i) => (
            <Typography
              key={i}
              variant="body2"
              sx={{ color: cssVar(palette.pendingText1) }}
            >
              {line}
            </Typography>
          ))}
        </div>
      )}
    </div>
  )
}
